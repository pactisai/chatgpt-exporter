import { describe, it, expect, beforeEach } from "vitest";

// Reset module state between tests — re-import to get fresh module
let isCircuitOpen, recordSuccess, recordFailure;

async function resetModule() {
  // Dynamic import to bust the module cache (circuit-breaker is a singleton by design,
  // but we can work around it via vitest's vi.resetModules + dynamic import)
  const mod = await import("../../core/parser/circuit-breaker.js");
  isCircuitOpen = mod.isCircuitOpen;
  recordSuccess = mod.recordSuccess;
  recordFailure = mod.recordFailure;
}

describe("Circuit Breaker", () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetModule();
  });

  it("starts closed", () => {
    expect(isCircuitOpen()).toBe(false);
  });

  it("stays closed after 1 failure", () => {
    recordFailure();
    expect(isCircuitOpen()).toBe(false);
  });

  it("stays closed after 2 failures", () => {
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(false);
  });

  it("opens after 3 consecutive failures", () => {
    recordFailure();
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(true);
  });

  it("opens after more than 3 failures", () => {
    recordFailure();
    recordFailure();
    recordFailure();
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(true);
  });

  it("resets to closed after success", () => {
    recordFailure();
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(true);

    recordSuccess();
    expect(isCircuitOpen()).toBe(false);
  });

  it("stays open within cooldown period", () => {
    recordFailure();
    recordFailure();
    recordFailure();
    expect(isCircuitOpen()).toBe(true);

    // Still open
    expect(isCircuitOpen()).toBe(true);
  });
});
