import { isChatGptShareUrl, getChatGptShareId } from "./parser/index.js";

// Layer 1: Protocol check
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Layer 2: Blocked hostnames/IPs (SSRF prevention)
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "[::]",
  "0",
]);

// Layer 3: Blocked IP ranges (CIDR)
function isPrivateIP(hostname) {
  // IPv4 private ranges
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 127) return true;                          // 127.0.0.0/8 (loopback)
    if (a === 0) return true;                            // 0.0.0.0/8
  }
  // IPv6 loopback
  if (hostname === "[::1]" || hostname === "[::]") return true;
  return false;
}

// Layer 4: Domain validation (allowlist)
function hasValidDomain(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;

    // Check private IPs
    if (isPrivateIP(hostname)) return false;

    // Must be chatgpt.com or chat.openai.com
    if (!hostname.endsWith("chatgpt.com") && !hostname.endsWith("chat.openai.com")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a ChatGPT share URL with SSRF protection layers:
 * 1. Must be a valid URL
 * 2. Must use http/https protocol
 * 3. Must not point to internal/private IPs
 * 4. Must be a recognized ChatGPT share URL format
 */
export function isValidShareUrl(input) {
  if (!input || typeof input !== "string") return false;

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }

  // Layer 1: Protocol
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return false;

  // Layer 2 & 3: Hostname validation (blocked hosts + private IPs + domain allowlist)
  if (!hasValidDomain(input)) return false;

  // Layer 4: ChatGPT-specific URL pattern (delegates to parser for share-id extraction)
  return isChatGptShareUrl(input);
}

export { getChatGptShareId };
