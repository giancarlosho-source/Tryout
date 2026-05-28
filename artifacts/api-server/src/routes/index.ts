import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import evaluationsRouter from "./evaluations";
import rankingsRouter from "./rankings";
import rostersRouter from "./rosters";
import notesRouter from "./notes";
import syncRouter from "./sync";
import aiRouter from "./ai";
import coachesRouter from "./coaches";
import settingsRouter from "./settings";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(evaluationsRouter);
router.use(rankingsRouter);
router.use(rostersRouter);
router.use(notesRouter);
router.use(syncRouter);
router.use(aiRouter);
router.use(coachesRouter);
router.use(settingsRouter);
router.use(exportRouter);

export default router;
