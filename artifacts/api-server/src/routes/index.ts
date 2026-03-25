import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thoughtMapsRouter from "./thoughtMaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/thought-maps", thoughtMapsRouter);

export default router;
