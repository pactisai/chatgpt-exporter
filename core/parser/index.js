/**
 * Vendored chatgpt-share-parser v0.1.1 (evanhu1)
 * Per ADR-002: vendor to mitigate single-maintainer / low-download risk.
 *
 * Re-exports all upstream functions plus:
 *  - Timeout wrapper (10s default for fetch)
 *  - Error classification (FastPathError, NetworkError)
 *  - Retry logic (1 retry on network errors)
 *  - Telemetry hooks (onSuccess, onError callbacks)
 */
import {
  fetchChatGptShare as _fetchChatGptShare,
  fetchChatGptShareHtml as _fetchChatGptShareHtml,
  parseChatGptShareHtml as _parseChatGptShareHtml,
  getChatGptShareId as _getChatGptShareId,
  isChatGptShareUrl as _isChatGptShareUrl,
  ChatGptShareAccessError,
  ChatGptShareFetchError,
  ChatGptShareParseError,
  parseModernShare,
  parseLegacyShare,
  chatGptShareToMarkdown,
  extractLoaderPayload,
  decodeLoader,
  stripPrivateUse,
  stripCitationTokens,
  summarizeToolPayload,
  buildAssetFilename,
  CHATGPT_SHARE_HEADERS,
} from "./vendor.js";

// ── Custom error classes ────────────────────────────────────────────
export class FastPathError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "FastPathError";
    this.cause = cause;
  }
}

export class NetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

function classifyError(err) {
  if (err instanceof ChatGptShareFetchError || err instanceof ChatGptShareAccessError) {
    return new NetworkError(err.message, err);
  }
  if (err instanceof ChatGptShareParseError) {
    return new FastPathError(err.message, err);
  }
  if (err.name === "AbortError" || err.name === "TimeoutError") {
    return new NetworkError(err.message, err);
  }
  return err instanceof FastPathError || err instanceof NetworkError
    ? err
    : new FastPathError(err.message, err);
}

// ── Telemetry hooks ─────────────────────────────────────────────────
let _onSuccess = null;
let _onError = null;

export function setTelemetryHooks({ onSuccess, onError } = {}) {
  _onSuccess = onSuccess || null;
  _onError = onError || null;
}

function emitSuccess(op, url, elapsedMs) {
  if (typeof _onSuccess === "function") {
    try { _onSuccess({ op, url, elapsedMs }); } catch { /* swallow */ }
  }
}

function emitError(op, url, err, elapsedMs) {
  if (typeof _onError === "function") {
    try { _onError({ op, url, err, elapsedMs }); } catch { /* swallow */ }
  }
}

// ── Wrapped fetch with timeout + retry ─────────────────────────────
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

async function _fetchWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const html = await _fetchChatGptShareHtml(url);
    return html;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch raw HTML of a ChatGPT share (with timeout).
 */
export async function fetchChatGptShareHtml(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  try {
    const html = await _fetchWithTimeout(url, timeoutMs);
    emitSuccess("fetchHtml", typeof url === "string" ? url : url.href, Date.now() - start);
    return html;
  } catch (err) {
    const elapsed = Date.now() - start;
    emitError("fetchHtml", typeof url === "string" ? url : url.href, err, elapsed);
    throw classifyError(err);
  }
}

/**
 * Fetch and parse a ChatGPT share (with timeout + retry).
 */
export async function fetchChatGptShare(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  let lastError;
  const maxAttempts = 1 + MAX_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const html = await _fetchWithTimeout(url, timeoutMs);
      const result = _parseChatGptShareHtml(html);
      emitSuccess("fetchShare", typeof url === "string" ? url : url.href, Date.now() - start);
      return result;
    } catch (err) {
      lastError = classifyError(err);
      // Only retry on network errors
      if (!(lastError instanceof NetworkError) || attempt >= maxAttempts) {
        break;
      }
    }
  }

  const elapsed = Date.now() - start;
  emitError("fetchShare", typeof url === "string" ? url : url.href, lastError, elapsed);
  throw lastError;
}

// ── Re-exports (wrapped / unwrapped) ───────────────────────────────
export { _parseChatGptShareHtml as parseChatGptShareHtmlRaw };

export function parseChatGptShareHtml(html) {
  try {
    return _parseChatGptShareHtml(html);
  } catch (err) {
    throw classifyError(err);
  }
}

// Direct passthrough — these are pure functions, no wrapping needed
export const getChatGptShareId = _getChatGptShareId;
export const isChatGptShareUrl = _isChatGptShareUrl;
export { ChatGptShareAccessError, ChatGptShareFetchError, ChatGptShareParseError };
export { parseModernShare, parseLegacyShare, chatGptShareToMarkdown };
export { extractLoaderPayload, decodeLoader };
export { stripPrivateUse, stripCitationTokens, summarizeToolPayload, buildAssetFilename };
export { CHATGPT_SHARE_HEADERS };
