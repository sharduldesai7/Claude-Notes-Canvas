import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thoughtMapsRouter from "./thoughtMaps";
import userSettingsRouter from "./userSettings";
import sharedRouter from "./shared";
import storageRouter from "./storage";
import guestSessionsRouter from "./guestSessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/guest-sessions", guestSessionsRouter);
router.use("/thought-maps", thoughtMapsRouter);
router.use("/user/settings", userSettingsRouter);
router.use("/shared", sharedRouter);
router.use(storageRouter);

export default router;
