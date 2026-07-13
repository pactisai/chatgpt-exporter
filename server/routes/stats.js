import { Router } from "express";
import { getMetrics } from "../metrics.js";
const router = Router();

router.get("/stats", (_req, res) => {
  res.json(getMetrics());
});

export default router;
