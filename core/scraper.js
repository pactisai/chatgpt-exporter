import { extractViaParser } from "./extractors/fast-path.js";
import { extractViaPlaywright } from "./extractors/playwright-fallback.js";
import { formatMarkdown, formatText } from "./formatters.js";

export async function scrapeChatGPT(shareUrl, onProgress) {
  try {
    const result = await extractViaParser(shareUrl, onProgress);
    return {
      ...result,
      markdown: formatMarkdown(result.turns),
      plainText: formatText(result.turns),
    };
  } catch (e) {
    console.warn("[scraper] Fast path failed:", e.message);
    const result = await extractViaPlaywright(shareUrl, onProgress);
    return {
      ...result,
      markdown: formatMarkdown(result.turns),
      plainText: formatText(result.turns),
    };
  }
}

export { formatMarkdown, formatText };
