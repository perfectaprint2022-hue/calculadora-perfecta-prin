import { Router, type IRouter } from "express";
import accessRouter from "./access";
import authRouter from "./auth";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(accessRouter);

export default router;
