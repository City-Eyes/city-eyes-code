import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ApiErrorSchema,
  CreateReportConfirmationBody,
  CreateReportConfirmationParams,
  CreateReportConfirmationResponse,
  GetCityReportParams,
  GetCityReportResponse,
  ListCitiesResponse,
  ListCityReportsParams,
  ListCityReportsQueryParams,
  ListCityReportsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { cities, reportConfirmations, reportEvents, reports } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { buildPublicPhotoUrl } from "../lib/report-presenter";

const router: IRouter = Router();

function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  return response
    .status(status)
    .json(ApiErrorSchema.parse({ code, message }));
}

router.get("/cities", async (_request, response) => {
  try {
    const rows = await db
      .select({
        id: cities.id,
        name: cities.name,
        state: cities.state,
        reportCount: count(reports.id),
      })
      .from(cities)
      .leftJoin(reports, eq(reports.cityId, cities.id))
      .groupBy(cities.id, cities.name, cities.state)
      .orderBy(asc(cities.name));

    const data = ListCitiesResponse.parse(
      rows.map((row) => ({ ...row, reportCount: Number(row.reportCount) })),
    );
    return response.json(data);
  } catch (error) {
    logger.error({ err: error }, "Failed to list supported cities");
    return sendApiError(
      response,
      500,
      "INTERNAL_ERROR",
      "Não foi possível carregar as cidades agora.",
    );
  }
});

router.get("/cities/:cityId/reports", async (request, response) => {
  const path = ListCityReportsParams.safeParse(request.params);
  if (!path.success) {
    return sendApiError(
      response,
      400,
      "INVALID_CITY",
      "A cidade informada não é válida.",
    );
  }

  const query = ListCityReportsQueryParams.safeParse(request.query);
  if (!query.success) {
    return sendApiError(
      response,
      400,
      "INVALID_PAGINATION",
      "Use uma página positiva e um limite entre 1 e 50.",
    );
  }

  try {
    const [city] = await db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .where(eq(cities.id, path.data.cityId))
      .limit(1);

    if (!city) {
      return sendApiError(response, 404, "CITY_NOT_FOUND", "Cidade não encontrada.");
    }

    const offset = (query.data.page - 1) * query.data.limit;
    const [totalRow] = await db
      .select({ total: count() })
      .from(reports)
      .where(eq(reports.cityId, city.id));

    const rows = await db
      .select({
        id: reports.id,
        cityId: reports.cityId,
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
      .where(eq(reports.cityId, city.id))
      .orderBy(desc(reports.createdAt), asc(reports.id))
      .limit(query.data.limit)
      .offset(offset);

    const total = Number(totalRow?.total ?? 0);
    const reportIds = rows.map((row) => row.id);
    const events = await getPublicEvents(request, reportIds);
    const eventsByReport = groupPublicEvents(events);
    const currentUserId = request.isAuthenticated() ? request.user?.id : null;
    const { countsByReport, userConfirmedByReport } = await getConfirmationsSummary(
      reportIds,
      currentUserId,
    );

    const data = ListCityReportsResponse.parse({
      items: rows.map((row) => {
        const counts = countsByReport.get(row.id) ?? {
          supportsCount: 0,
          resolutionConfirmationsCount: 0,
        };
        const userStatus = userConfirmedByReport.get(row.id) ?? {
          userHasSupported: false,
          userHasConfirmedResolution: false,
        };
        return {
          id: row.id,
          cityId: row.cityId,
          cityName: city.name,
          title: row.title,
          description: row.description,
          category: row.category,
          locationLabel: row.locationLabel,
          latitude: row.latitude,
          longitude: row.longitude,
          photoUrl: row.imageObjectPath
            ? buildPublicPhotoUrl(request, row.imageObjectPath)
            : null,
          status: row.status,
          supportsCount: counts.supportsCount,
          resolutionConfirmationsCount: counts.resolutionConfirmationsCount,
          userHasSupported: userStatus.userHasSupported,
          userHasConfirmedResolution: userStatus.userHasConfirmedResolution,
          events: eventsByReport.get(row.id) ?? [],
          createdAt: row.createdAt,
          isDemo: row.isDemo,
        };
      }),
      page: query.data.page,
      limit: query.data.limit,
      total,
      hasNextPage: offset + rows.length < total,
    });
    return response.json(data);
  } catch (error) {
    logger.error({ err: error }, "Failed to list public city reports");
    return sendApiError(
      response,
      500,
      "INTERNAL_ERROR",
      "Não foi possível carregar os relatos agora.",
    );
  }
});

router.get(
  "/cities/:cityId/reports/:reportId",
  async (request, response) => {
    const path = GetCityReportParams.safeParse(request.params);
    if (!path.success) {
      return sendApiError(
        response,
        400,
        "INVALID_REPORT",
        "A cidade ou o relato informado não é válido.",
      );
    }

    try {
      const [row] = await db
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
        .where(
          and(
            eq(reports.cityId, path.data.cityId),
            eq(reports.id, path.data.reportId),
          ),
        )
        .limit(1);

      if (!row) {
        return sendApiError(
          response,
          404,
          "REPORT_NOT_FOUND",
          "Relato não encontrado nesta cidade.",
        );
      }

      const events = await getPublicEvents(request, [row.id]);
      const currentUserId = request.isAuthenticated() ? request.user?.id : null;
      const { countsByReport, userConfirmedByReport } = await getConfirmationsSummary(
        [row.id],
        currentUserId,
      );
      const counts = countsByReport.get(row.id) ?? {
        supportsCount: 0,
        resolutionConfirmationsCount: 0,
      };
      const userStatus = userConfirmedByReport.get(row.id) ?? {
        userHasSupported: false,
        userHasConfirmedResolution: false,
      };

      return response.json(
        GetCityReportResponse.parse({
          ...row,
          photoUrl: row.imageObjectPath
            ? buildPublicPhotoUrl(request, row.imageObjectPath)
            : null,
          supportsCount: counts.supportsCount,
          resolutionConfirmationsCount: counts.resolutionConfirmationsCount,
          userHasSupported: userStatus.userHasSupported,
          userHasConfirmedResolution: userStatus.userHasConfirmedResolution,
          events,
        }),
      );
    } catch (error) {
      logger.error({ err: error }, "Failed to load public city report");
      return sendApiError(
        response,
        500,
        "INTERNAL_ERROR",
        "Não foi possível carregar o relato agora.",
      );
    }
  },
);

router.post(
  "/cities/:cityId/reports/:reportId/confirmations",
  async (request, response) => {
    if (!request.isAuthenticated() || !request.user?.id) {
      return sendApiError(
        response,
        401,
        "UNAUTHORIZED",
        "É necessário entrar para apoiar ou confirmar um relato.",
      );
    }

    const path = CreateReportConfirmationParams.safeParse(request.params);
    if (!path.success) {
      return sendApiError(
        response,
        400,
        "INVALID_REPORT",
        "A cidade ou o relato informado não é válido.",
      );
    }

    const body = CreateReportConfirmationBody.safeParse(request.body);
    if (!body.success) {
      return sendApiError(
        response,
        400,
        "INVALID_CONFIRMATION_TYPE",
        "Informe um tipo de confirmação válido ('support' ou 'resolution').",
      );
    }

    try {
      const [report] = await db
        .select({ id: reports.id, status: reports.status })
        .from(reports)
        .where(
          and(
            eq(reports.cityId, path.data.cityId),
            eq(reports.id, path.data.reportId),
          ),
        )
        .limit(1);

      if (!report) {
        return sendApiError(
          response,
          404,
          "REPORT_NOT_FOUND",
          "Relato não encontrado nesta cidade.",
        );
      }

      const confirmationId = randomUUID();
      try {
        await db.insert(reportConfirmations).values({
          id: confirmationId,
          reportId: report.id,
          userId: request.user.id,
          type: body.data.type,
        });
      } catch (insertError: any) {
        const pgCode = insertError?.code ?? insertError?.cause?.code;
        if (pgCode === "23505") {
          return sendApiError(
            response,
            409,
            "ALREADY_CONFIRMED",
            "Você já enviou esta confirmação para este relato.",
          );
        }
        throw insertError;
      }

      const [countRow] = await db
        .select({ total: count() })
        .from(reportConfirmations)
        .where(
          and(
            eq(reportConfirmations.reportId, report.id),
            eq(reportConfirmations.type, body.data.type),
          ),
        );

      return response.json(
        CreateReportConfirmationResponse.parse({
          ok: true,
          type: body.data.type,
          count: Number(countRow?.total ?? 1),
          userHasConfirmed: true,
        }),
      );
    } catch (error) {
      logger.error({ err: error }, "Failed to register report confirmation");
      return sendApiError(
        response,
        500,
        "INTERNAL_ERROR",
        "Não foi possível registrar a confirmação agora.",
      );
    }
  },
);

export default router;

async function getConfirmationsSummary(
  reportIds: string[],
  userId?: string | null,
) {
  if (reportIds.length === 0) {
    return {
      countsByReport: new Map<
        string,
        { supportsCount: number; resolutionConfirmationsCount: number }
      >(),
      userConfirmedByReport: new Map<
        string,
        { userHasSupported: boolean; userHasConfirmedResolution: boolean }
      >(),
    };
  }

  const counts = await db
    .select({
      reportId: reportConfirmations.reportId,
      type: reportConfirmations.type,
      total: count(),
    })
    .from(reportConfirmations)
    .where(inArray(reportConfirmations.reportId, reportIds))
    .groupBy(reportConfirmations.reportId, reportConfirmations.type);

  const countsByReport = new Map<
    string,
    { supportsCount: number; resolutionConfirmationsCount: number }
  >();
  for (const c of counts) {
    const entry = countsByReport.get(c.reportId) ?? {
      supportsCount: 0,
      resolutionConfirmationsCount: 0,
    };
    if (c.type === "support") entry.supportsCount = Number(c.total);
    if (c.type === "resolution") entry.resolutionConfirmationsCount = Number(c.total);
    countsByReport.set(c.reportId, entry);
  }

  const userConfirmedByReport = new Map<
    string,
    { userHasSupported: boolean; userHasConfirmedResolution: boolean }
  >();
  if (userId) {
    const userRows = await db
      .select({
        reportId: reportConfirmations.reportId,
        type: reportConfirmations.type,
      })
      .from(reportConfirmations)
      .where(
        and(
          inArray(reportConfirmations.reportId, reportIds),
          eq(reportConfirmations.userId, userId),
        ),
      );

    for (const row of userRows) {
      const entry = userConfirmedByReport.get(row.reportId) ?? {
        userHasSupported: false,
        userHasConfirmedResolution: false,
      };
      if (row.type === "support") entry.userHasSupported = true;
      if (row.type === "resolution") entry.userHasConfirmedResolution = true;
      userConfirmedByReport.set(row.reportId, entry);
    }
  }

  return { countsByReport, userConfirmedByReport };
}

async function getPublicEvents(request: Request, reportIds: string[]) {
  if (reportIds.length === 0) return [];
  const rows = await db
    .select({
      id: reportEvents.id,
      reportId: reportEvents.reportId,
      statusBefore: reportEvents.statusBefore,
      statusAfter: reportEvents.statusAfter,
      publicNote: reportEvents.publicNote,
      evidenceImageObjectPath: reportEvents.evidenceImageObjectPath,
      createdAt: reportEvents.createdAt,
    })
    .from(reportEvents)
    .where(inArray(reportEvents.reportId, reportIds))
    .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));

  return rows.map((row) => ({
    id: row.id,
    reportId: row.reportId,
    statusBefore: row.statusBefore,
    statusAfter: row.statusAfter,
    publicNote: row.publicNote,
    evidenceImageUrl: row.evidenceImageObjectPath
      ? buildPublicPhotoUrl(request, row.evidenceImageObjectPath)
      : null,
    createdAt: row.createdAt,
  }));
}

function groupPublicEvents(
  events: Awaited<ReturnType<typeof getPublicEvents>>,
) {
  const map = new Map<
    string,
    Array<Omit<(typeof events)[number], "reportId">>
  >();
  for (const event of events) {
    const { reportId, ...publicFields } = event;
    const current = map.get(reportId) ?? [];
    current.push(publicFields);
    map.set(reportId, current);
  }
  return map;
}
