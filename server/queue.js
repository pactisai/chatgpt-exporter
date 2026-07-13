import PQueue from "p-queue";
import { LRUCache } from "lru-cache";
import { scrapeChatGPT } from "../core/scraper.js";

const MAX_CONCURRENT = 2;
const CACHE_MAX = 200;
const CACHE_TTL = 60 * 60 * 1000;

const cache = new LRUCache({
  max: CACHE_MAX,
  ttl: CACHE_TTL,
});

const jobs = new Map();
const queue = new PQueue({ concurrency: MAX_CONCURRENT });

export function enqueue(url) {
  const cached = cache.get(url);
  if (cached) {
    const id = crypto.randomUUID();
    jobs.set(id, { id, status: "done", url, result: cached, createdAt: Date.now() });
    return id;
  }

  const id = crypto.randomUUID();
  jobs.set(id, {
    id,
    status: "queued",
    url,
    progress: { phase: "queued", message: "Waiting..." },
    createdAt: Date.now(),
  });

  queue.add(async () => {
    const job = jobs.get(id);
    if (!job) return;
    job.status = "processing";
    job.startedAt = Date.now();

    try {
      const result = await scrapeChatGPT(job.url, (p) => { job.progress = p; });
      job.status = "done";
      job.result = result;
      job.completedAt = Date.now();
      cache.set(job.url, result);
    } catch (e) {
      job.status = "error";
      job.error = e.message;
      job.completedAt = Date.now();
      console.error("[queue] Job failed:", e.message);
    }
  });

  return id;
}

export function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  const { status, progress, result, error, url, createdAt } = job;
  return { id, status, progress, result, error, url, createdAt };
}
