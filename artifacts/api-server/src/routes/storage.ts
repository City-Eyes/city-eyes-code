import {
  ApiErrorSchema,
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, mediaUploads } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ObjectNotFoundError,
  ObjectStorageService,
  type ImageStorage,
} from "../lib/objectStorage";
import { requireAuthenticated } from "../middlewares/authMiddleware";

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const UNATTACHED_MEDIA_TTL_MS = 24 * 60 * 60 * 1000;

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json(ApiErrorSchema.parse({ code, message }));
}

export function createStorageRouter(
  storage: ImageStorage = new ObjectStorageService(),
): IRouter {
  const router: IRouter = Router();

  router.post(
    "/storage/uploads/request-url",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      const parsed = RequestUploadUrlBody.safeParse(req.body);
      if (!parsed.success) {
        return sendApiError(
          res,
          400,
          "INVALID_UPLOAD",
          "Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.",
        );
      }

      try {
        const { uploadURL, objectPath } = await storage.createUploadUrl();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + UNATTACHED_MEDIA_TTL_MS);
        await db.insert(mediaUploads).values({
          objectPath,
          ownerId: req.user!.id,
          contentType: parsed.data.contentType,
          expectedSize: parsed.data.size,
          requestedAt: now,
          uploadUrlExpiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_MS),
          expiresAt,
        });
        return res.json(
          RequestUploadUrlResponse.parse({
            uploadURL,
            objectPath,
            expiresAt,
          }),
        );
      } catch (error) {
        req.log.error(
          {
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          "Could not prepare a photo upload",
        );
        return sendApiError(
          res,
          503,
          "PHOTO_STORAGE_UNAVAILABLE",
          "Não foi possível preparar o envio da foto. Tente novamente.",
        );
      }
    },
  );

  router.get("/storage/objects/*path", async (req, res) => {
    const rawPath = req.params.path;
    const path = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    if (!path || path.includes("..") || path.includes("\\")) {
      return sendApiError(res, 404, "PHOTO_NOT_FOUND", "Foto não encontrada.");
    }

    try {
      const image = await storage.streamPublicImage(`/objects/${path}`);
      res.setHeader("Content-Type", image.contentType);
      res.setHeader("Content-Length", String(image.size));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cache-Control", "public, max-age=300");
      image.stream.on("error", (error) => {
        req.log.error(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Could not stream a report photo",
        );
        if (!res.headersSent) {
          sendApiError(
            res,
            500,
            "PHOTO_UNAVAILABLE",
            "A foto não está disponível agora.",
          );
        } else {
          res.destroy();
        }
      });
      image.stream.pipe(res);
      return;
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return sendApiError(
          res,
          404,
          "PHOTO_NOT_FOUND",
          "Foto não encontrada.",
        );
      }
      req.log.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Could not load a report photo",
      );
      return sendApiError(
        res,
        503,
        "PHOTO_UNAVAILABLE",
        "A foto não está disponível agora.",
      );
    }
  });

  return router;
}

export default createStorageRouter();
