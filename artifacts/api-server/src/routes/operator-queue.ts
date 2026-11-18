import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  ListOperatorReportsParams,
  ListOperatorReportsQueryParams,
  ListOperatorReportsResponse,
  ListOperatorCitiesResponse,
  type ReportStatus,
  UpdateOperatorReportBody,
  UpdateOperatorReportParams,
  UpdateOperatorReportResponse,
} from "@workspace/api-zod";
import { db, cityMemberships, reportConfirmations, reportEvents, reports } from "@workspace/db";
import { cities } from "@workspace/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ne,
  or,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { buildPublicPhotoUrl } from "../lib/report-presenter";
import { requireAuthenticated } from "../middlewares/authMiddleware";

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json(ApiErrorSchema.parse({ code, message }));
}

const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  open: ["in_review", "in_progress"],
  in_review: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};

export function createOperatorQueueRouter(): IRouter {
  const router: IRouter = Router();

  router.get(
    "/operator/cities",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const rows = await db
          .select({
            id: cities.id,
            name: cities.name,
            state: cities.state,
            openReportCount: count(reports.id),
          })
          .from(cities)
          .innerJoin(
            cityMemberships,
            and(
              eq(cityMemberships.cityId, cities.id),
              eq(cityMemberships.userId, req.user!.id),
              or(
                eq(cityMemberships.role, "operator"),
                eq(cityMemberships.role, "city_admin"),
              ),
            ),
          )
          .leftJoin(
            reports,
            and(
              eq(reports.cityId, cities.id),
              ne(reports.status, "resolved"),
            ),
          )
          .groupBy(cities.id, cities.name, cities.state)
          .orderBy(asc(cities.name));
        return res.json(
          ListOperatorCitiesResponse.parse(
            rows.map((row) => ({
              ...row,
              openReportCount: Number(row.openReportCount),
            })),
          ),
        );
      } catch (error) {
        req.log.error(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Could not list operator cities",
        );
        return sendApiError(
          res,
          500,
          "OPERATOR_CITIES_UNAVAILABLE",
          "Não foi possível carregar as cidades autorizadas.",
        );
      }
    },
  );

  router.get(
    "/operator/cities/:cityId/reports",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      const path = ListOperatorReportsParams.safeParse(req.params);
      if (!path.success) {
        return sendApiError(
          res,
          400,
          "INVALID_CITY",
          "A cidade selecionada não é válida.",
        );
      }
      const query = ListOperatorReportsQueryParams.safeParse(req.query);
      if (!query.success) {
        return sendApiError(
          res,
          400,
          "INVALID_PAGINATION",
          "Informe parâmetros válidos para a fila.",
        );
      }
      try {
        const access = await getAuthorizedCity(req.user!.id, path.data.cityId);
        if (access === "missing") {
          return sendApiError(
            res,
            404,
            "CITY_NOT_FOUND",
            "A cidade selecionada não está disponível.",
          );
        }
        if (!access) {
          return sendApiError(
            res,
            403,
            "CITY_ACCESS_DENIED",
            "Sua conta não tem acesso à fila desta cidade.",
          );
        }
        const criteria = query.data.status
          ? and(
              eq(reports.cityId, path.data.cityId),
              eq(reports.status, query.data.status),
            )
          : eq(reports.cityId, path.data.cityId);
        const offset = (query.data.page - 1) * query.data.limit;
        const [totalRow] = await db
          .select({ total: count() })
          .from(reports)
          .where(criteria);
        const rows = await db
          .select({
            id: reports.id,
            cityId: reports.cityId,
            cityName: cities.name,
            title: reports.title,
            description: reports.description,
            category: reports.category,
            locationLabel: reports.locationLabel,
            latitude: reports.latitude,
            longitude: reports.longitude,
            imageObjectPath: reports.imageObjectPath,
            status: reports.status,
            createdAt: reports.createdAt,
            isDemo: reports.isDemo,
          })
          .from(reports)
          .innerJoin(cities, eq(reports.cityId, cities.id))
          .where(criteria)
          .orderBy(
            ...(query.data.sort === "oldest"
              ? [asc(reports.createdAt), asc(reports.id)]
              : [desc(reports.createdAt), asc(reports.id)]),
          )
          .limit(query.data.limit)
          .offset(offset);

        const reportIds = rows.map((row) => row.id);
        const events = reportIds.length
          ? await db
              .select({
                id: reportEvents.id,
                reportId: reportEvents.reportId,
                statusBefore: reportEvents.statusBefore,
                statusAfter: reportEvents.statusAfter,
                publicNote: reportEvents.publicNote,
                internalNote: reportEvents.internalNote,
                evidenceImageObjectPath: reportEvents.evidenceImageObjectPath,
                createdAt: reportEvents.createdAt,
              })
              .from(reportEvents)
              .where(inArray(reportEvents.reportId, reportIds))
              .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id))
          : [];
        const eventsByReport = groupEvents(req, events);

        const countsByReport = new Map<
          string,
          { supportsCount: number; resolutionConfirmationsCount: number }
        >();
        if (reportIds.length) {
          const counts = await db
            .select({
              reportId: reportConfirmations.reportId,
              type: reportConfirmations.type,
              total: count(),
            })
            .from(reportConfirmations)
            .where(inArray(reportConfirmations.reportId, reportIds))
            .groupBy(reportConfirmations.reportId, reportConfirmations.type);

          for (const c of counts) {
            const entry = countsByReport.get(c.reportId) ?? {
              supportsCount: 0,
              resolutionConfirmationsCount: 0,
            };
            if (c.type === "support") entry.supportsCount = Number(c.total);
            if (c.type === "resolution") entry.resolutionConfirmationsCount = Number(c.total);
            countsByReport.set(c.reportId, entry);
          }
        }

        const total = Number(totalRow?.total ?? 0);
        return res.json(
          ListOperatorReportsResponse.parse({
            items: rows.map((row) => {
              const c = countsByReport.get(row.id) ?? {
                supportsCount: 0,
                resolutionConfirmationsCount: 0,
              };
              return {
                id: row.id,
                cityId: row.cityId,
                cityName: row.cityName,
                title: row.title,
                description: row.description,
                category: row.category,
                locationLabel: row.locationLabel,
                latitude: row.latitude,
                longitude: row.longitude,
                photoUrl: row.imageObjectPath
                  ? buildPublicPhotoUrl(req, row.imageObjectPath)
                  : null,
                status: row.status,
                supportsCount: c.supportsCount,
                resolutionConfirmationsCount: c.resolutionConfirmationsCount,
                createdAt: row.createdAt,
                isDemo: row.isDemo,
                events: eventsByReport.get(row.id) ?? [],
              };
            }),
            page: query.data.page,
            limit: query.data.limit,
            total,
            hasNextPage: offset + rows.length < total,
          }),
        );
      } catch (error) {
        req.log.error(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Could not load an operator report queue",
        );
        return sendApiError(
          res,
          500,
          "OPERATOR_QUEUE_UNAVAILABLE",
          "Não foi possível carregar a fila agora.",
        );
      }
    },
  );

  router.patch(
    "/operator/cities/:cityId/reports/:reportId",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      const path = UpdateOperatorReportParams.safeParse(req.params);
      if (!path.success) {
        return sendApiError(
          res,
          400,
          "INVALID_REPORT",
          "A cidade ou o relato selecionado não é válido.",
        );
      }
      const body = UpdateOperatorReportBody.safeParse(req.body);
      if (!body.success) {
        return sendApiError(
          res,
          400,
          "INVALID_REPORT_UPDATE",
          "Dados inválidos para a atualização do relato.",
        );
      }
      try {
        const publicNote = body.data.publicNote?.trim() || null;
        const internalNote = body.data.internalNote?.trim() || null;
        const evidenceImageObjectPath = body.data.evidenceImageObjectPath?.trim() || null;

        const updateResult = await db.transaction(async (tx) => {
          const access = await getAuthorizedCity(req.user!.id, path.data.cityId);
          if (access === "missing") return { error: "CITY_NOT_FOUND" as const };
          if (!access) return { error: "CITY_ACCESS_DENIED" as const };

          const [existing] = await tx
            .select()
            .from(reports)
            .where(
              and(
                eq(reports.id, path.data.reportId),
                eq(reports.cityId, path.data.cityId),
              ),
            )
            .for("update")
            .limit(1);
          if (!existing) return { error: "REPORT_NOT_FOUND" as const };

          const nextStatus = body.data.status ?? existing.status;
          const isStatusChanged = nextStatus !== existing.status;

          // Se o status não mudou e nenhuma nota ou evidência foi informada, rejeita como atualização vazia
          if (!isStatusChanged && !publicNote && !internalNote && !evidenceImageObjectPath) {
            return { error: "EMPTY_REPORT_UPDATE" as const };
          }

          // Se o status mudou, valida transição permitida pela máquina de estados
          if (isStatusChanged) {
            const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status as ReportStatus] ?? [];
            if (!allowed.includes(nextStatus as ReportStatus)) {
              return { error: "INVALID_STATUS_TRANSITION" as const };
            }
          }

          const [report] = await tx
            .update(reports)
            .set({ status: nextStatus })
            .where(eq(reports.id, existing.id))
            .returning();
          const eventId = randomUUID();
          const createdAt = new Date();
          await tx.insert(reportEvents).values({
            id: eventId,
            reportId: existing.id,
            cityId: existing.cityId,
            statusBefore: existing.status,
            statusAfter: nextStatus,
            publicNote: publicNote ?? null,
            internalNote: internalNote ?? null,
            evidenceImageObjectPath,
            actorId: req.user!.id,
            createdAt,
          });
          const history = await tx
            .select({
              id: reportEvents.id,
              statusBefore: reportEvents.statusBefore,
              statusAfter: reportEvents.statusAfter,
              publicNote: reportEvents.publicNote,
              internalNote: reportEvents.internalNote,
              evidenceImageObjectPath: reportEvents.evidenceImageObjectPath,
              createdAt: reportEvents.createdAt,
            })
            .from(reportEvents)
            .where(eq(reportEvents.reportId, existing.id))
            .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));
          const [city] = await tx
            .select({ name: cities.name })
            .from(cities)
            .where(eq(cities.id, existing.cityId))
            .limit(1);

          const confirmationCounts = await tx
            .select({
              type: reportConfirmations.type,
              total: count(),
            })
            .from(reportConfirmations)
            .where(eq(reportConfirmations.reportId, existing.id))
            .groupBy(reportConfirmations.type);

          let supportsCount = 0;
          let resolutionConfirmationsCount = 0;
          for (const c of confirmationCounts) {
            if (c.type === "support") supportsCount = Number(c.total);
            if (c.type === "resolution") resolutionConfirmationsCount = Number(c.total);
          }

          return {
            report,
            history,
            cityName: city?.name ?? "",
            supportsCount,
            resolutionConfirmationsCount,
          };
        });

        if ("error" in updateResult) {
          switch (updateResult.error) {
            case "CITY_NOT_FOUND":
              return sendApiError(
                res,
                404,
                "CITY_NOT_FOUND",
                "A cidade selecionada não está disponível.",
              );
            case "CITY_ACCESS_DENIED":
              return sendApiError(
                res,
                403,
                "CITY_ACCESS_DENIED",
                "Sua conta não tem acesso à fila desta cidade.",
              );
            case "REPORT_NOT_FOUND":
              return sendApiError(
                res,
                404,
                "REPORT_NOT_FOUND",
                "O relato não existe nesta fila.",
              );
            case "EMPTY_REPORT_UPDATE":
              return sendApiError(
                res,
                400,
                "EMPTY_REPORT_UPDATE",
                "Informe um novo status, uma nota ou uma evidência.",
              );
            case "INVALID_STATUS_TRANSITION":
              return sendApiError(
                res,
                400,
                "INVALID_STATUS_TRANSITION",
                "A transição de status solicitada não é permitida para este relato.",
              );
          }
        }
        const updated = updateResult;
        return res.json(
          UpdateOperatorReportResponse.parse({
            id: updated.report.id,
            cityId: updated.report.cityId,
            cityName: updated.cityName,
            title: updated.report.title,
            description: updated.report.description,
            category: updated.report.category,
            locationLabel: updated.report.locationLabel,
            latitude: updated.report.latitude,
            longitude: updated.report.longitude,
            photoUrl: updated.report.imageObjectPath
              ? buildPublicPhotoUrl(req, updated.report.imageObjectPath)
              : null,
            status: updated.report.status,
            supportsCount: updated.supportsCount,
            resolutionConfirmationsCount: updated.resolutionConfirmationsCount,
            createdAt: updated.report.createdAt,
            isDemo: updated.report.isDemo,
            events: updated.history.map((event) => ({
              id: event.id,
              statusBefore: event.statusBefore,
              statusAfter: event.statusAfter,
              publicNote: event.publicNote,
              internalNote: event.internalNote,
              evidenceImageUrl: event.evidenceImageObjectPath
                ? buildPublicPhotoUrl(req, event.evidenceImageObjectPath)
                : null,
              createdAt: event.createdAt,
            })),
          }),
        );
      } catch (error) {
        req.log.error(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Could not update an operator report",
        );
        return sendApiError(
          res,
          500,
          "REPORT_UPDATE_FAILED",
          "Não foi possível atualizar o relato agora.",
        );
      }
    },
  );

  return router;
}

async function getAuthorizedCity(
  userId: string,
  cityId: string,
): Promise<boolean | "missing"> {
  const [city] = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.id, cityId))
    .limit(1);
  if (!city) return "missing";
  const [membership] = await db
    .select({ userId: cityMemberships.userId })
    .from(cityMemberships)
    .where(
      and(
        eq(cityMemberships.userId, userId),
        eq(cityMemberships.cityId, cityId),
        or(
          eq(cityMemberships.role, "operator"),
          eq(cityMemberships.role, "city_admin"),
        ),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

function groupEvents(
  req: Request,
  events: Array<{
    id: string;
    reportId: string;
    statusBefore: (typeof reports.$inferSelect)["status"] | null;
    statusAfter: (typeof reports.$inferSelect)["status"];
    publicNote: string | null;
    internalNote: string | null;
    evidenceImageObjectPath: string | null;
    createdAt: Date;
  }>,
) {
  const map = new Map<
    string,
    Array<{
      id: string;
      statusBefore: (typeof reports.$inferSelect)["status"] | null;
      statusAfter: (typeof reports.$inferSelect)["status"];
      publicNote: string | null;
      internalNote: string | null;
      evidenceImageUrl: string | null;
      createdAt: Date;
    }>
  >();
  for (const event of events) {
    const { reportId, evidenceImageObjectPath, ...publicFields } = event;
    const current = map.get(reportId) ?? [];
    current.push({
      ...publicFields,
      evidenceImageUrl: evidenceImageObjectPath
        ? buildPublicPhotoUrl(req, evidenceImageObjectPath)
        : null,
    });
    map.set(reportId, current);
  }
  return map;
}

export default createOperatorQueueRouter();
