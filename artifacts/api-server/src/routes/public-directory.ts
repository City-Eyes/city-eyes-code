import { and, asc, count, desc, eq } from "drizzle-orm";
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
import { cities, reports } from "@workspace/db/schema";
import { logger } from "../lib/logger";

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
        createdAt: reports.createdAt,
        isDemo: reports.isDemo,
      })
      .from(reports)
      .where(eq(reports.cityId, city.id))
      .orderBy(desc(reports.createdAt), asc(reports.id))
      .limit(query.data.limit)
      .offset(offset);

    const total = Number(totalRow?.total ?? 0);
    const data = ListCityReportsResponse.parse({
      items: rows.map((row) => ({ ...row, cityName: city.name })),
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

      return response.json(GetCityReportResponse.parse(row));
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
