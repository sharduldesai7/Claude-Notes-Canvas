import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thoughtMapsRouter from "./thoughtMaps";
import userSettingsRouter from "./userSettings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/thought-maps", thoughtMapsRouter);
router.use("/user/settings", userSettingsRouter);

export default router;
