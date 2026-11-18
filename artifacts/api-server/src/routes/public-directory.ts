import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  ApiErrorSchema,
  GetCityReportParams,
  GetCityReportResponse,
  ListCitiesResponse,
  ListCityReportsParams,
  ListCityReportsQueryParams,
  ListCityReportsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { cities, reportEvents, reports } from "@workspace/db/schema";
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
    const events = await getPublicEvents(rows.map((row) => row.id));
    const eventsByReport = groupPublicEvents(events);
    const data = ListCityReportsResponse.parse({
      items: rows.map((row) => ({
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
        events: eventsByReport.get(row.id) ?? [],
        createdAt: row.createdAt,
        isDemo: row.isDemo,
      })),
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

      const events = await getPublicEvents([row.id]);
      return response.json(
        GetCityReportResponse.parse({
          ...row,
          photoUrl: row.imageObjectPath
            ? buildPublicPhotoUrl(request, row.imageObjectPath)
            : null,
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

export default router;

async function getPublicEvents(reportIds: string[]) {
  if (reportIds.length === 0) return [];
  return db
    .select({
      id: reportEvents.id,
      reportId: reportEvents.reportId,
      statusBefore: reportEvents.statusBefore,
      statusAfter: reportEvents.statusAfter,
      publicNote: reportEvents.publicNote,
      createdAt: reportEvents.createdAt,
    })
    .from(reportEvents)
    .where(inArray(reportEvents.reportId, reportIds))
    .orderBy(asc(reportEvents.createdAt), asc(reportEvents.id));
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
