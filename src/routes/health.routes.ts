import { Router } from "express";
import { getHealth } from "../controllers/health.controllers.js";

const router = Router();

router.get("/", getHealth);

export default router;
