import { Router } from "express";
import { getOgImage } from "../og-image.js";
const router = Router();

router.get("/og-image.png", async (_req, res) => {
  try {
    const png = await getOgImage();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch { res.status(500).end(); }
});

export default router;
