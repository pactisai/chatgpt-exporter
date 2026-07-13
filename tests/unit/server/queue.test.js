import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// Hoisted mock definitions — shared across all tests
// ============================================================
const {
  mockCacheGet,
  mockCacheSet,
  mockAddFn,
  lruOpts,
  pqOpts,
  mockRecordEnqueue,
  mockRecordComplete,
  mockRecordScrape,
  mockRecordSuccess,
  mockRecordFailure,
  mockRecordCacheHit,
  mockRecordCacheMiss,
} = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockAddFn: vi.fn(),
  lruOpts: /** @type {Record<string, unknown>} */ ({}),
  pqOpts: /** @type {Record<string, unknown>} */ ({}),
  mockRecordEnqueue: vi.fn(),
  mockRecordComplete: vi.fn(),
  mockRecordScrape: vi.fn(),
  mockRecordSuccess: vi.fn(),
  mockRecordFailure: vi.fn(),
  mockRecordCacheHit: vi.fn(),
  mockRecordCacheMiss: vi.fn(),
}));

// Use regular function (not arrow) so `new` works
vi.mock("lru-cache", () => ({
  LRUCache: vi.fn(function (opts) {
    Object.assign(lruOpts, opts);
    return { get: mockCacheGet, set: mockCacheSet };
  }),
}));

vi.mock("p-queue", () => ({
  default: vi.fn(function (opts) {
    Object.assign(pqOpts, opts);
    return { add: mockAddFn };
  }),
}));

vi.mock("../../../server/metrics.js", () => ({
  recordEnqueue: mockRecordEnqueue,
  recordComplete: mockRecordComplete,
  recordScrape: mockRecordScrape,
  recordSuccess: mockRecordSuccess,
  recordFailure: mockRecordFailure,
  recordCacheHit: mockRecordCacheHit,
  recordCacheMiss: mockRecordCacheMiss,
}));

const mockScrapeResult = Object.freeze({
  turns: [{ index: 1, role: "user", content: "test" }],
  markdown: "# Test",
  plainText: "Test",
  totalTurns: 1,
  scrapedAt: new Date().toISOString(),
  elapsedSeconds: 0.1,
  method: "fastpath-parser",
});

vi.mock("../../../core/scraper.js", () => ({
  scrapeChatGPT: vi.fn().mockResolvedValue(mockScrapeResult),
}));

// ============================================================
// Helpers
// ============================================================
const SAMPLE_URL = "https://chatgpt.com/share/test-123";

/** @type {typeof import("../../../server/queue.js").enqueue} */
let enqueue;
/** @type {typeof import("../../../server/queue.js").getJob} */
let getJob;

/**
 * Resets module cache, clears option collectors, re-imports the queue module.
 * Call after configuring mock implementations in beforeEach.
 */
async function resetAndImport() {
  vi.resetModules();

  // Wipe option collectors so each import writes fresh options
  for (const k of Object.keys(lruOpts)) delete lruOpts[k];
  for (const k of Object.keys(pqOpts)) delete pqOpts[k];

  const mod = await import("../../../server/queue.js");
  enqueue = mod.enqueue;
  getJob = mod.getJob;
}

// ============================================================
// Suite 1: enqueue — cache hits
// ============================================================
describe("enqueue — cache hits", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(mockScrapeResult);
    mockAddFn.mockImplementation(function () {});
    await resetAndImport();
  });

  it("returns { jobId, status: 'done' } immediately", () => {
    const result = enqueue(SAMPLE_URL);
    expect(result).toHaveProperty("jobId");
    expect(result.status).toBe("done");
    expect(typeof result.jobId).toBe("string");
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  it("calls recordCacheHit", () => {
    enqueue(SAMPLE_URL);
    expect(mockRecordCacheHit).toHaveBeenCalledTimes(1);
  });

  it("does NOT call recordCacheMiss or recordEnqueue", () => {
    enqueue(SAMPLE_URL);
    expect(mockRecordCacheMiss).not.toHaveBeenCalled();
    expect(mockRecordEnqueue).not.toHaveBeenCalled();
  });

  it("does NOT add a job to the p-queue (no network call needed)", () => {
    enqueue(SAMPLE_URL);
    expect(mockAddFn).not.toHaveBeenCalled();
  });

  it("getJob returns the cached result with status 'done'", () => {
    const { jobId } = enqueue(SAMPLE_URL);
    const job = getJob(jobId);

    expect(job).not.toBeNull();
    expect(job.status).toBe("done");
    expect(job.url).toBe(SAMPLE_URL);
    expect(job.result).toEqual(mockScrapeResult);
    expect(job.error).toBeUndefined();
    expect(job).toHaveProperty("createdAt");
  });
});

// ============================================================
// Suite 2: enqueue — cache misses
// ============================================================
describe("enqueue — cache misses", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(undefined);
    mockAddFn.mockImplementation(function () {});
    await resetAndImport();
  });

  it("returns { jobId, status: 'queued' }", () => {
    const result = enqueue(SAMPLE_URL);
    expect(result).toHaveProperty("jobId");
    expect(result.status).toBe("queued");
    expect(typeof result.jobId).toBe("string");
  });

  it("calls recordCacheMiss", () => {
    enqueue(SAMPLE_URL);
    expect(mockRecordCacheMiss).toHaveBeenCalledTimes(1);
  });

  it("calls recordEnqueue", () => {
    enqueue(SAMPLE_URL);
    expect(mockRecordEnqueue).toHaveBeenCalledTimes(1);
  });

  it("does NOT call recordCacheHit", () => {
    enqueue(SAMPLE_URL);
    expect(mockRecordCacheHit).not.toHaveBeenCalled();
  });

  it("adds the job to the p-queue with a task function", () => {
    enqueue(SAMPLE_URL);
    expect(mockAddFn).toHaveBeenCalledTimes(1);
    const [taskFn] = mockAddFn.mock.calls[0];
    expect(taskFn).toBeInstanceOf(Function);
  });

  it("stored job has correct initial state (queued with progress)", () => {
    const { jobId } = enqueue(SAMPLE_URL);
    const job = getJob(jobId);

    expect(job.status).toBe("queued");
    expect(job.url).toBe(SAMPLE_URL);
    expect(job.progress).toEqual({ phase: "queued", message: "Waiting..." });
    expect(job.result).toBeUndefined();
    expect(job.error).toBeUndefined();
    expect(job).toHaveProperty("createdAt");
  });
});

// ============================================================
// Suite 3: getJob
// ============================================================
describe("getJob", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetAndImport();
  });

  it("returns null for a non-existent job ID", () => {
    expect(getJob("nonexistent-id")).toBeNull();
  });

  it("returns null for an empty string ID", () => {
    expect(getJob("")).toBeNull();
  });

  it("returns all expected fields for a queued job", () => {
    mockCacheGet.mockReturnValue(undefined);
    mockAddFn.mockImplementation(function () {});

    const { jobId } = enqueue(SAMPLE_URL);
    const job = getJob(jobId);

    expect(job).toMatchObject({
      id: jobId,
      status: "queued",
      url: SAMPLE_URL,
    });
    expect(job).toHaveProperty("progress");
    expect(job).toHaveProperty("createdAt");
    expect(job.result).toBeUndefined();
    expect(job.error).toBeUndefined();
  });

  it("returns result for a done (cache-hit) job, no error", () => {
    mockCacheGet.mockReturnValue(mockScrapeResult);

    const { jobId } = enqueue(SAMPLE_URL);
    const job = getJob(jobId);

    expect(job.status).toBe("done");
    expect(job.result).toEqual(mockScrapeResult);
    expect(job.error).toBeUndefined();
  });
});

// ============================================================
// Suite 4: Job lifecycle (queued → processing → done / error)
// ============================================================
describe("Job lifecycle", () => {
  /** @type {Function | null} */
  let capturedTask;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(undefined);
    capturedTask = null;

    // Capture the async task so we can control when it executes
    mockAddFn.mockImplementation(function (task) {
      capturedTask = task;
    });

    await resetAndImport();
  });

  it("starts in 'queued' state with progress info", () => {
    const { jobId } = enqueue(SAMPLE_URL);
    const job = getJob(jobId);

    expect(job.status).toBe("queued");
    expect(job.progress).toEqual({ phase: "queued", message: "Waiting..." });
    expect(job.createdAt).toBeDefined();
    expect(job.result).toBeUndefined();
    expect(job.error).toBeUndefined();
  });

  it("transitions to 'done' after the task completes successfully", async () => {
    const { jobId } = enqueue(SAMPLE_URL);

    // Before task executes — still queued
    expect(getJob(jobId).status).toBe("queued");

    // Execute the captured task (simulates queue drain)
    expect(capturedTask).toBeInstanceOf(Function);
    await capturedTask();

    // After task — should be done with result
    const job = getJob(jobId);
    expect(job.status).toBe("done");
    expect(job.result).toEqual(mockScrapeResult);
    expect(job.error).toBeUndefined();
  });

  it("records success metrics on completion", async () => {
    enqueue(SAMPLE_URL);
    await capturedTask();

    expect(mockRecordScrape).toHaveBeenCalledWith("fastpath-parser");
    expect(mockRecordSuccess).toHaveBeenCalledTimes(1);
    expect(mockRecordComplete).toHaveBeenCalledTimes(1);
  });

  it("caches the result after a successful scrape", async () => {
    enqueue(SAMPLE_URL);
    await capturedTask();

    expect(mockCacheSet).toHaveBeenCalledWith(SAMPLE_URL, mockScrapeResult);
  });

  it("transitions to 'error' when the scraper throws", async () => {
    // Override the scraper mock to reject for this test only
    const { scrapeChatGPT } = await import("../../../core/scraper.js");
    scrapeChatGPT.mockRejectedValueOnce(new Error("Scrape failed"));

    const { jobId } = enqueue(SAMPLE_URL);
    await capturedTask();

    const job = getJob(jobId);
    expect(job.status).toBe("error");
    expect(job.error).toBe("Scrape failed");
    expect(job.result).toBeUndefined();
  });

  it("records failure metrics when the scraper throws", async () => {
    const { scrapeChatGPT } = await import("../../../core/scraper.js");
    scrapeChatGPT.mockRejectedValueOnce(new Error("Boom"));

    enqueue(SAMPLE_URL);
    await capturedTask();

    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
    expect(mockRecordSuccess).not.toHaveBeenCalled();
    expect(mockRecordComplete).not.toHaveBeenCalled();
  });
});

// ============================================================
// Suite 5: Queue concurrency
// ============================================================
describe("Queue concurrency", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(undefined);
    mockAddFn.mockImplementation(function () {});
    await resetAndImport();
  });

  it("creates p-queue with concurrency = 2", () => {
    expect(pqOpts.concurrency).toBe(2);
  });

  it("multiple rapid enqueues all return 'queued' status", () => {
    const urls = [
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
    ];
    const results = urls.map((url) => enqueue(url));

    results.forEach((r) => {
      expect(r.status).toBe("queued");
      expect(r).toHaveProperty("jobId");
    });
    expect(mockAddFn).toHaveBeenCalledTimes(3);
  });

  it("each enqueued job receives a unique ID", () => {
    const ids = new Set([
      enqueue("https://example.com/a").jobId,
      enqueue("https://example.com/b").jobId,
      enqueue("https://example.com/c").jobId,
    ]);

    expect(ids.size).toBe(3);
  });
});

// ============================================================
// Suite 6: Cache behavior (constructor options)
// ============================================================
describe("Cache behavior", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetAndImport();
  });

  it("sets TTL to 1 hour (3,600,000 ms)", () => {
    expect(lruOpts.ttl).toBe(3_600_000);
  });

  it("sets max cache size to 200 items", () => {
    expect(lruOpts.max).toBe(200);
  });
});
