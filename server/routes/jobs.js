import { Router } from "express";
import { enqueue, getJob } from "../queue.js";
import { isValidShareUrl } from "../../core/validate.js";
const router = Router();

router.post("/jobs", (req, res) => {
  const { url } = req.body;
  if (!isValidShareUrl(url)) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  const { jobId, status } = enqueue(url.trim());
  if (!jobId) {
    return res.status(503).json({ error: "Server busy. Try again later." });
  }
  res.json({ jobId, status });
});

router.get("/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

export default router;
