import { Router } from "express";

import {
  createManualHardcopyStatistics,
  getFormStatistics,
  getItemStatistics,
  getSectionStatistics,
  getStatisticsSummary,
} from "../controllers/statistics.controllers.js";

const router = Router();

router.get("/summary", getStatisticsSummary);
router.get("/forms", getFormStatistics);
router.get("/sections", getSectionStatistics);
router.get("/items", getItemStatistics);
router.post("/manual-hardcopy", createManualHardcopyStatistics);

export default router;