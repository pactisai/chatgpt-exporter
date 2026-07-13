// Simple circuit breaker: after 3 consecutive fast-path failures, skip fast-path for 60s
let failures = 0;
let openUntil = 0;
const THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

export function isCircuitOpen() {
  if (Date.now() < openUntil) return true;
  return false;
}

export function recordSuccess() {
  failures = 0;
  openUntil = 0;
}

export function recordFailure() {
  failures++;
  if (failures >= THRESHOLD) {
    openUntil = Date.now() + COOLDOWN_MS;
  }
}
