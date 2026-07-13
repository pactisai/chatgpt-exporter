import { fetchChatGptShare } from "../parser/index.js";
import { isCircuitOpen, recordSuccess, recordFailure } from "../parser/circuit-breaker.js";

export async function extractViaParser(shareUrl, onProgress) {
  onProgress?.({ phase: "fastpath", message: "Fetching via API..." });
  const startTime = Date.now();

  if (isCircuitOpen()) {
    const err = new Error("Circuit breaker open");
    err.code = "CIRCUIT_OPEN";
    throw err;
  }

  try {
    const chat = await fetchChatGptShare(shareUrl);

    if (chat && chat.replies && chat.replies.length > 0) {
      const turns = chat.replies.map((r, i) => ({
        index: i + 1,
        role: r.type === "user" ? "user" : "assistant",
        content: formatReply(r),
      }));

      const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
      onProgress?.({ phase: "done", message: `Done: ${turns.length} turns (instant)` });
      recordSuccess();

      return {
        turns,
        totalTurns: turns.length,
        scrapedAt: new Date().toISOString(),
        elapsedSeconds: elapsed,
        method: "fastpath-parser",
      };
    }

    // Empty or invalid — throw to trigger fallback
    throw new Error("No replies found in fast-path response");
  } catch (e) {
    recordFailure();
    throw e;
  }
}

function formatReply(reply) {
  const prefix = reply.type === "assistant" ? "ChatGPT said:" : "You said:";
  let text = prefix + reply.statement;
  if (reply.assets && reply.assets.length > 0) {
    for (const asset of reply.assets) {
      if (asset.assetType === "image") {
        text += `\n[${asset.assetType}: ${asset.filename || asset.url}]`;
      }
    }
  }
  return text;
}
