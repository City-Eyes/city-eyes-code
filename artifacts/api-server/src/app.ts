import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { createApiRouter } from "./routes";
import { logger } from "./lib/logger";
import type { ImageStorage } from "./lib/objectStorage";

export function createApp(storage?: ImageStorage): Express {
  const app: Express = express();
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors());
  app.use(cookieParser());
  app.use(express.json({ limit: "128kb" }));
  app.use(express.urlencoded({ extended: true, limit: "128kb" }));

  app.use("/api", createApiRouter(storage));
  app.use(
    (
      error: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      req.log.error(
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Unhandled API request error",
      );
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a solicitação agora.",
      });
    },
  );

  return app;
}

const app = createApp();
export default app;
