import { describe, it, expect } from "vitest";
import {
  fetchChatGptShare,
  fetchChatGptShareHtml,
  parseChatGptShareHtml,
  getChatGptShareId,
  isChatGptShareUrl,
  FastPathError,
  NetworkError,
  parseChatGptShareHtmlRaw,
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
  ChatGptShareAccessError,
  ChatGptShareFetchError,
  ChatGptShareParseError,
} from "../../core/parser/index.js";

describe("Parser wrapper — re-exports", () => {
  it("exports getChatGptShareId (pure)", () => {
    expect(typeof getChatGptShareId).toBe("function");
    const id = getChatGptShareId("https://chatgpt.com/share/abc123def456");
    expect(id).toBe("abc123def456");
  });

  it("exports isChatGptShareUrl (pure)", () => {
    expect(typeof isChatGptShareUrl).toBe("function");
    expect(isChatGptShareUrl("https://chatgpt.com/share/abc123def456")).toBe(true);
    expect(isChatGptShareUrl("https://google.com")).toBe(false);
    expect(isChatGptShareUrl("")).toBe(false);
  });

  it("exports parseChatGptShareHtml", () => {
    expect(typeof parseChatGptShareHtml).toBe("function");
  });

  it("exports fetchChatGptShare", () => {
    expect(typeof fetchChatGptShare).toBe("function");
  });

  it("exports fetchChatGptShareHtml", () => {
    expect(typeof fetchChatGptShareHtml).toBe("function");
  });

  it("exports error classes", () => {
    expect(typeof FastPathError).toBe("function");
    expect(typeof NetworkError).toBe("function");
    expect(typeof ChatGptShareAccessError).toBe("function");
    expect(typeof ChatGptShareFetchError).toBe("function");
    expect(typeof ChatGptShareParseError).toBe("function");
  });

  it("exports parse functions", () => {
    expect(typeof parseChatGptShareHtmlRaw).toBe("function");
    expect(typeof parseModernShare).toBe("function");
    expect(typeof parseLegacyShare).toBe("function");
    expect(typeof chatGptShareToMarkdown).toBe("function");
  });

  it("exports loader utilities", () => {
    expect(typeof extractLoaderPayload).toBe("function");
    expect(typeof decodeLoader).toBe("function");
  });

  it("exports text utilities", () => {
    expect(typeof stripPrivateUse).toBe("function");
    expect(typeof stripCitationTokens).toBe("function");
    expect(typeof summarizeToolPayload).toBe("function");
    expect(typeof buildAssetFilename).toBe("function");
  });

  it("exports CHATGPT_SHARE_HEADERS", () => {
    expect(typeof CHATGPT_SHARE_HEADERS).toBe("object");
    expect(CHATGPT_SHARE_HEADERS).toHaveProperty("User-Agent");
    expect(CHATGPT_SHARE_HEADERS).toHaveProperty("Referer");
    expect(CHATGPT_SHARE_HEADERS.Referer).toBe("https://chatgpt.com/");
  });
});

describe("FastPathError", () => {
  it("has name FastPathError", () => {
    const err = new FastPathError("test");
    expect(err.name).toBe("FastPathError");
    expect(err.message).toBe("test");
  });

  it("can chain a cause", () => {
    const cause = new Error("root cause");
    const err = new FastPathError("wrapper", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("NetworkError", () => {
  it("has name NetworkError", () => {
    const err = new NetworkError("test");
    expect(err.name).toBe("NetworkError");
    expect(err.message).toBe("test");
  });

  it("can chain a cause", () => {
    const cause = new Error("root cause");
    const err = new NetworkError("wrapper", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("URL validation (exported from vendor)", () => {
  const validUrls = [
    "https://chatgpt.com/share/abc123def456",
    "https://chatgpt.com/share/xyz-789",
    "https://chat.openai.com/share/old-format-id",
  ];

  const invalidUrls = [
    "",
    "not-a-url",
    "https://google.com",
    "https://chatgpt.com/not-a-share",
  ];

  it.each(validUrls)("accepts valid URL: %s", (url) => {
    expect(isChatGptShareUrl(url)).toBe(true);
    expect(getChatGptShareId(url)).toBeTruthy();
  });

  it.each(invalidUrls)("rejects invalid URL: %s", (url) => {
    expect(isChatGptShareUrl(url)).toBe(false);
    expect(getChatGptShareId(url)).toBeNull();
  });
});
