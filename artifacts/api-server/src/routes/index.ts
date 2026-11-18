import { Router, type IRouter } from "express";
import type { ImageStorage } from "../lib/objectStorage";
import { ObjectStorageService } from "../lib/objectStorage";
import { authMiddleware } from "../middlewares/authMiddleware";
import authRouter from "./auth";
import healthRouter from "./health";
import publicDirectoryRouter from "./public-directory";
import { createReportSubmissionRouter } from "./report-submission";
import { createStorageRouter } from "./storage";

export function createApiRouter(
  storage: ImageStorage = new ObjectStorageService(),
): IRouter {
  const router: IRouter = Router();

  router.use(authMiddleware);
  router.use(authRouter);
  router.use(healthRouter);
  router.use(publicDirectoryRouter);
  router.use(createStorageRouter(storage));
  router.use(createReportSubmissionRouter(storage));
  return router;
}

export default createApiRouter();
