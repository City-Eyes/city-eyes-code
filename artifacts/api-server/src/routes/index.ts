import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicDirectoryRouter from "./public-directory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicDirectoryRouter);

export default router;
