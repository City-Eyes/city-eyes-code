import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

type DatabaseCheck = () => Promise<unknown>;
type DatabaseState = "unavailable" | "recovered";
type DatabaseStateLogger = (state: DatabaseState) => void;

function logDatabaseState(state: DatabaseState) {
  const context = { event: "database_readiness", state };

  if (state === "unavailable") {
    logger.error(context, "Database readiness unavailable");
    return;
  }

  logger.info(context, "Database readiness recovered");
}

export function createHealthRouter(
  checkDatabase: DatabaseCheck = () =>
    pool.query("SELECT 1"),
  logState: DatabaseStateLogger = logDatabaseState,
): IRouter {
  const router: IRouter = Router();
  let lastDatabaseState: "available" | "unavailable" | undefined;

  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  });

  router.get("/readyz", async (_req, res) => {
    try {
      await checkDatabase();
      if (lastDatabaseState === "unavailable") {
        logState("recovered");
      }
      lastDatabaseState = "available";
      res.json({ status: "ok", dependencies: { database: "ok" } });
    } catch {
      if (lastDatabaseState !== "unavailable") {
        logState("unavailable");
      }
      lastDatabaseState = "unavailable";
      res.status(503).json({
        status: "error",
        dependencies: { database: "unavailable" },
      });
    }
  });

  return router;
}

export default createHealthRouter();
