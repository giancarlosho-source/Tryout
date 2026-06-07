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
import eventsRouter from "../events";
import registerRouter from "./register";
import authRouter from "./auth";
import photosRouter from "./photos";
import staffRouter from "./staff";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(eventsRouter);
router.use(registerRouter);
router.use(playersRouter);
router.use(photosRouter);
router.use(evaluationsRouter);
router.use(rankingsRouter);
router.use(rostersRouter);
router.use(notesRouter);
router.use(syncRouter);
router.use(aiRouter);
router.use(coachesRouter);
router.use(settingsRouter);
router.use(exportRouter);
router.use(staffRouter);

export default router;
