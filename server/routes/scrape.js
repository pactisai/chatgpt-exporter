import { Router } from "express";
import { scrapeChatGPT } from "../../core/scraper.js";
import { isValidShareUrl } from "../../core/validate.js";
const router = Router();

router.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!isValidShareUrl(url)) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  try {
    const r = await scrapeChatGPT(url, send);
    send({ type: "done", ...r });
  } catch (e) {
    send({ type: "error", error: e.message });
  } finally {
    res.end();
  }
});

export default router;
