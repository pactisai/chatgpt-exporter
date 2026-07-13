import { Router } from "express";
const router = Router();

router.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

export default router;
