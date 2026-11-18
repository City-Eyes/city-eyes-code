import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  ListOperatorReportsParams,
  ListOperatorReportsQueryParams,
  ListOperatorReportsResponse,
  ListOperatorCitiesResponse,
  UpdateOperatorReportBody,
  UpdateOperatorReportParams,
  UpdateOperatorReportResponse,
} from "@workspace/api-zod";
import { db, cityMemberships, reportEvents, reports } from "@workspace/db";
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
          .from(cityMemberships)
          .innerJoin(cities, eq(cityMemberships.cityId, cities.id))
          .leftJoin(
            reports,
            and(
              eq(reports.cityId, cities.id),
              ne(reports.status, "resolved"),
            ),
          )
          .where(
            and(
              eq(cityMemberships.userId, req.user!.id),
              or(
                eq(cityMemberships.role, "operator"),
                eq(cityMemberships.role, "city_admin"),
              ),
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
          "Could not load operator cities",
        );
        return sendApiError(
          res,
          500,
          "OPERATOR_QUEUE_UNAVAILABLE",
          "Não foi possível carregar suas cidades agora.",
        );
      }
    },
  );

  router.get(
    "/operator/cities/:cityId/reports",
    requireAuthenticated,
    async (req: Request, res: Response) => {
      const path = ListOperatorReportsParams.safeParse(req.params);
      const query = ListOperatorReportsQueryParams.safeParse(req.query);
      if (!path.success || !query.success) {
        return sendApiError(
          res,
          400,
          "INVALID_QUEUE_FILTER",
          "Confira a cidade, o filtro e a paginação.",
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
        const events = rows.length
          ? await db
              .select({
                id: reportEvents.id,
                reportId: reportEvents.reportId,
                statusBefore: reportEvents.statusBefore,
                statusAfter: reportEvents.statusAfter,
                publicNote: reportEvents.publicNote,
                internalNote: reportEvents.internalNote,
                createdAt: reportEvents.createdAt,
              })
              .from(reportEvents)
              .where(inArray(reportEvents.reportId, rows.map((row) => row.id)))
              .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id))
          : [];
        const eventsByReport = groupEvents(events);
        const total = Number(totalRow?.total ?? 0);
        return res.json(
          ListOperatorReportsResponse.parse({
            items: rows.map((row) => ({
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
              createdAt: row.createdAt,
              isDemo: row.isDemo,
              events: eventsByReport.get(row.id) ?? [],
            })),
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
      const body = UpdateOperatorReportBody.safeParse(req.body);
      if (!path.success || !body.success) {
        return sendApiError(
          res,
          400,
          "INVALID_REPORT_UPDATE",
          "Confira a atualização e tente novamente.",
        );
      }
      const publicNote = body.data.publicNote?.trim() || undefined;
      const internalNote = body.data.internalNote?.trim() || undefined;
      if (
        body.data.status === undefined &&
        publicNote === undefined &&
        internalNote === undefined
      ) {
        return sendApiError(
          res,
          400,
          "EMPTY_REPORT_UPDATE",
          "Informe um novo status ou uma nota.",
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

        const updated = await db.transaction(async (tx) => {
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
          if (!existing) return null;
          const nextStatus = body.data.status ?? existing.status;
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
          return { report, history, cityName: city?.name ?? "" };
        });
        if (!updated) {
          return sendApiError(
            res,
            404,
            "REPORT_NOT_FOUND",
            "O relato não existe nesta fila.",
          );
        }
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
            createdAt: updated.report.createdAt,
            isDemo: updated.report.isDemo,
            events: updated.history,
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
  events: Array<{
    id: string;
    reportId: string;
    statusBefore: (typeof reports.$inferSelect)["status"] | null;
    statusAfter: (typeof reports.$inferSelect)["status"];
    publicNote: string | null;
    internalNote: string | null;
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
      createdAt: Date;
    }>
  >();
  for (const event of events) {
    const { reportId, ...publicFields } = event;
    const current = map.get(reportId) ?? [];
    current.push(publicFields);
    map.set(reportId, current);
  }
  return map;
}

export default createOperatorQueueRouter();
