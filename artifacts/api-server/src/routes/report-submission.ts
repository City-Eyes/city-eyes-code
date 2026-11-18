import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  CreateCityReportBody,
  CreateCityReportParams,
  CreateCityReportResponse,
} from "@workspace/api-zod";
import { db, mediaUploads, reportEvents, reports } from "@workspace/db";
import { cities, type ReportRecord } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import type { CityRecord } from "@workspace/db/schema";
import {
  InvalidUploadedImageError,
  ObjectNotFoundError,
  ObjectStorageService,
  type ImageStorage,
} from "../lib/objectStorage";
import { buildPublicPhotoUrl } from "../lib/report-presenter";
import { requireAuthenticated } from "../middlewares/authMiddleware";

const PHOTO_RETENTION_DAYS = 30;

class UploadConflictError extends Error {}
class PhotoStorageError extends Error {}

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json(ApiErrorSchema.parse({ code, message }));
}

export function isPointWithinCityBounds(
  city: Pick<
    CityRecord,
    | "bboxMinLatitude"
    | "bboxMinLongitude"
    | "bboxMaxLatitude"
    | "bboxMaxLongitude"
  >,
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= city.bboxMinLatitude &&
    latitude <= city.bboxMaxLatitude &&
    longitude >= city.bboxMinLongitude &&
    longitude <= city.bboxMaxLongitude
  );
}

export function createReportSubmissionRouter(
  storage: ImageStorage = new ObjectStorageService(),
): IRouter {
  const router: IRouter = Router();

  router.post(
    "/cities/:cityId/reports",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      const path = CreateCityReportParams.safeParse(req.params);
      const parsed = CreateCityReportBody.safeParse(req.body);
      if (!path.success || !parsed.success) {
        return sendApiError(
          res,
          400,
          "INVALID_REPORT",
          "Confira os campos do relato e tente novamente.",
        );
      }

      const input = {
        ...parsed.data,
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        locationLabel: parsed.data.locationLabel.trim(),
      };
      if (
        input.title.length < 3 ||
        input.description.length < 3 ||
        input.locationLabel.length < 1 ||
        !input.consentToPublicDisplay
      ) {
        return sendApiError(
          res,
          400,
          "INVALID_REPORT",
          "Confira o texto, a localização e a autorização de publicação.",
        );
      }

      try {
        const [city] = await db
          .select()
          .from(cities)
          .where(eq(cities.id, path.data.cityId))
          .limit(1);
        if (!city) {
          return sendApiError(
            res,
            404,
            "CITY_NOT_FOUND",
            "A cidade selecionada não está disponível.",
          );
        }
        if (
          !isPointWithinCityBounds(
            city,
            input.latitude,
            input.longitude,
          )
        ) {
          return sendApiError(
            res,
            400,
            "LOCATION_OUTSIDE_CITY",
            "Revise a localização: o ponto está fora dos limites aproximados desta cidade.",
          );
        }

        const now = new Date();
        const [upload] = await db
          .select()
          .from(mediaUploads)
          .where(eq(mediaUploads.objectPath, input.imageObjectPath))
          .limit(1);
        if (!upload || upload.ownerId !== req.user!.id) {
          return sendApiError(
            res,
            404,
            "PHOTO_NOT_FOUND",
            "A foto enviada não está disponível. Selecione-a novamente.",
          );
        }
        if (
          upload.reportId ||
          upload.uploadUrlExpiresAt <= now ||
          upload.expiresAt <= now
        ) {
          return sendApiError(
            res,
            409,
            "PHOTO_UPLOAD_EXPIRED",
            "O envio da foto expirou. Selecione-a novamente.",
          );
        }

        let finalObjectPath: string;
        try {
          const verified = await storage.verifyImage(
            upload.objectPath,
            upload.contentType,
            upload.expectedSize,
          );
          finalObjectPath = verified.objectPath;
        } catch (error) {
          if (error instanceof ObjectNotFoundError) {
            return sendApiError(
              res,
              404,
              "PHOTO_NOT_FOUND",
              "A foto enviada não está disponível. Selecione-a novamente.",
            );
          }
          if (error instanceof InvalidUploadedImageError) {
            return sendApiError(
              res,
              400,
              "INVALID_PHOTO",
              "A foto não corresponde a um arquivo JPEG, PNG ou WebP válido.",
            );
          }
          req.log.warn(
            {
              errorName: error instanceof Error ? error.name : "UnknownError",
            },
            "Could not verify an uploaded report photo",
          );
          return sendApiError(
            res,
            503,
            "PHOTO_STORAGE_UNAVAILABLE",
            "Não foi possível verificar a foto agora. Tente novamente.",
          );
        }

        const publicPhotoUrl = buildPublicPhotoUrl(req, finalObjectPath);
        const reportId = randomUUID();
        const eventId = randomUUID();
        const retentionDeadline = new Date(
          now.getTime() + PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        );
        let result: (ReportRecord & { cityName: string }) | undefined;

        try {
          await db.transaction(async (tx) => {
            const [lockedUpload] = await tx
              .select()
              .from(mediaUploads)
              .where(
                and(
                  eq(mediaUploads.objectPath, upload.objectPath),
                  eq(mediaUploads.ownerId, req.user!.id),
                  isNull(mediaUploads.reportId),
                ),
              )
              .for("update")
              .limit(1);
            if (
              !lockedUpload ||
              lockedUpload.uploadUrlExpiresAt <= new Date() ||
              lockedUpload.expiresAt <= new Date()
            ) {
              throw new UploadConflictError();
            }

            try {
              await storage.setVisibility(
                finalObjectPath,
                req.user!.id,
                "public",
              );
            } catch {
              throw new PhotoStorageError();
            }

            const [created] = await tx
              .insert(reports)
              .values({
                id: reportId,
                cityId: city.id,
                reporterId: req.user!.id,
                title: input.title,
                description: input.description,
                category: input.category,
                locationLabel: input.locationLabel,
                latitude: input.latitude,
                longitude: input.longitude,
                imageObjectPath: finalObjectPath,
                captureSource: input.captureSource,
                publicConsentAt: now,
                status: "open",
                createdAt: now,
                isDemo: false,
              })
              .returning();
            await tx.insert(reportEvents).values({
              id: eventId,
              reportId,
              cityId: city.id,
              statusBefore: null,
              statusAfter: "open",
              publicNote: null,
              internalNote: null,
              actorId: req.user!.id,
              createdAt: now,
            });
            await tx
              .update(mediaUploads)
              .set({ reportId })
              .where(eq(mediaUploads.objectPath, upload.objectPath));
            await tx.insert(mediaUploads).values({
              objectPath: finalObjectPath,
              ownerId: req.user!.id,
              contentType: upload.contentType,
              expectedSize: upload.expectedSize,
              requestedAt: now,
              uploadUrlExpiresAt: now,
              expiresAt: retentionDeadline,
              reportId,
            });
            result = { ...created, cityName: city.name };
          });
        } catch (error) {
          {
            try {
              await storage.deleteObject(finalObjectPath);
            } catch {
              try {
                await storage.setVisibility(finalObjectPath, req.user!.id, "private");
              } catch (deleteError) {
                req.log.error(
                  {
                    errorName:
                      deleteError instanceof Error
                        ? deleteError.name
                        : "UnknownError",
                  },
                  "Could not clean up a failed report photo",
                );
              }
            }
          }
          if (error instanceof UploadConflictError) {
            return sendApiError(
              res,
              409,
              "PHOTO_UPLOAD_EXPIRED",
              "A foto já foi usada ou o envio expirou. Selecione-a novamente.",
            );
          }
          if (error instanceof PhotoStorageError) {
            return sendApiError(
              res,
              503,
              "PHOTO_STORAGE_UNAVAILABLE",
              "Não foi possível publicar a foto agora. Seu rascunho foi mantido.",
            );
          }
          req.log.error(
            {
              errorName: error instanceof Error ? error.name : "UnknownError",
            },
            "Could not save an urban report",
          );
          return sendApiError(
            res,
            500,
            "REPORT_SUBMISSION_FAILED",
            "Não foi possível enviar o relato agora. Seu rascunho foi mantido.",
          );
        }

        if (!result) {
          return sendApiError(
            res,
            500,
            "REPORT_SUBMISSION_FAILED",
            "Não foi possível enviar o relato agora. Seu rascunho foi mantido.",
          );
        }
        return res.status(201).json(
          CreateCityReportResponse.parse({
            id: result.id,
            cityId: result.cityId,
            cityName: result.cityName,
            title: result.title,
            description: result.description,
            category: result.category,
            locationLabel: result.locationLabel,
            createdAt: result.createdAt,
            isDemo: result.isDemo,
            latitude: result.latitude,
            longitude: result.longitude,
            photoUrl: publicPhotoUrl,
            status: result.status,
            events: [
              {
                id: eventId,
                statusBefore: null,
                statusAfter: "open",
                publicNote: null,
                createdAt: now,
              },
            ],
          }),
        );
      } catch (error) {
        req.log.error(
          {
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          "Could not prepare an urban report",
        );
        return sendApiError(
          res,
          500,
          "REPORT_SUBMISSION_FAILED",
          "Não foi possível enviar o relato agora. Seu rascunho foi mantido.",
        );
      }
    },
  );

  return router;
}

export default createReportSubmissionRouter();
