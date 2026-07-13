import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockShareResponse,
  mockEmptyShareResponse,
  mockLargeShareResponse,
} from "../../fixtures/mock-share-response.js";

// ── Module mocks (hoisted) ───────────────────────────────────────
// Mock all transitive dependencies so scraper.js can be imported
// without real network, browser, or Playwright side-effects.

vi.mock("../../../core/parser/index.js", () => ({
  fetchChatGptShare: vi.fn(),
  fetchChatGptShareHtml: vi.fn(),
  parseChatGptShareHtml: vi.fn(),
}));

vi.mock("../../../core/parser/circuit-breaker.js", () => ({
  isCircuitOpen: vi.fn(() => false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock("../../../core/pool.js", () => ({
  getPage: vi.fn(),
  releasePage: vi.fn(),
}));

vi.mock("../../../core/blocker.js", () => ({
  installResourceBlockers: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports under test ───────────────────────────────────────────
import { scrapeChatGPT } from "../../../core/scraper.js";
import { formatMarkdown, formatText } from "../../../core/formatters.js";

// Mocked dependencies — references that scraper.js uses internally
import { fetchChatGptShare } from "../../../core/parser/index.js";
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
} from "../../../core/parser/circuit-breaker.js";
import { getPage, releasePage } from "../../../core/pool.js";

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Replicates the internal formatReply() logic for building expected
 * turn content arrays.  Useful for constructing assertion targets
 * without calling private functions.
 */
function expectedTurnContent(reply) {
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

// ─────────────────────────────────────────────────────────────────
//  Suite 1 — formatMarkdown
// ─────────────────────────────────────────────────────────────────
describe("formatMarkdown", () => {
  const turns = [
    { index: 1, role: "user", content: "Hello world" },
    { index: 2, role: "assistant", content: "Hi there" },
    { index: 3, role: "user", content: "How are you?" },
  ];

  it("should format turns with headers and separators", () => {
    const result = formatMarkdown(turns);
    expect(result).toContain("# ChatGPT Conversation Export");
    expect(result).toContain("---");
    expect(result).toContain("*Exported by ChatGPT Exporter by Pactis*");
  });

  it("should label assistant turns as '### Assistant'", () => {
    const result = formatMarkdown(turns);
    expect(result).toContain("### Assistant");
  });

  it("should label user turns as '### User'", () => {
    const result = formatMarkdown(turns);
    expect(result).toContain("### User");
  });

  it("should include turn index numbers", () => {
    const result = formatMarkdown(turns);
    expect(result).toContain("(Turn 1)");
    expect(result).toContain("(Turn 2)");
    expect(result).toContain("(Turn 3)");
  });

  it("should embed turn content between header and separator", () => {
    const result = formatMarkdown(turns);
    // The output pattern is: ### Role (Turn N)\n\n<content>\n\n---
    expect(result).toContain("Hello world");
    expect(result).toContain("Hi there");
    expect(result).toContain("How are you?");
  });

  it("should handle empty turns array gracefully", () => {
    const result = formatMarkdown([]);
    expect(result).toContain("# ChatGPT Conversation Export");
    expect(result).not.toContain("(Turn ");
    // Should still have the --- header separator
    const occurrences = (result.match(/---/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
//  Suite 2 — formatText
// ─────────────────────────────────────────────────────────────────
describe("formatText", () => {
  const turns = [
    { index: 1, role: "user", content: "Hello world" },
    { index: 2, role: "assistant", content: "Hi there" },
  ];

  it("should format turns with plain text labels", () => {
    const result = formatText(turns);
    expect(result).toContain("[User - Turn 1]");
    expect(result).toContain("[Assistant - Turn 2]");
  });

  it("should include turn index numbers", () => {
    const result = formatText(turns);
    expect(result).toContain("Turn 1");
    expect(result).toContain("Turn 2");
  });

  it("should not contain markdown headers", () => {
    const result = formatText(turns);
    expect(result).not.toContain("###");
  });

  it("should include a plain-text title header", () => {
    const result = formatText(turns);
    expect(result).toContain("ChatGPT Conversation Export");
    expect(result).toContain("==========================");
  });

  it("should embed turn content", () => {
    const result = formatText(turns);
    expect(result).toContain("Hello world");
    expect(result).toContain("Hi there");
  });

  it("should handle empty turns array", () => {
    const result = formatText([]);
    expect(result).toContain("ChatGPT Conversation Export");
    expect(result).not.toContain("[User");
    expect(result).not.toContain("[Assistant");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Suite 3 — formatReply (tested via scrapeChatGPT fast-path output)
// ─────────────────────────────────────────────────────────────────
describe("formatReply (via scrapeChatGPT output)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCircuitOpen.mockReturnValue(false);
    fetchChatGptShare.mockResolvedValue(mockShareResponse);
  });

  it("should prefix user messages with 'You said:'", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    // Turn 1 is a user reply: "Hello, how does this work?"
    expect(result.turns[0].content).toBe("You said:Hello, how does this work?");
    expect(result.turns[0].role).toBe("user");
  });

  it("should prefix assistant messages with 'ChatGPT said:'", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    // Turn 2 is an assistant reply: "Hi! I'm doing well."
    expect(result.turns[1].content).toBe("ChatGPT said:Hi! I'm doing well.");
    expect(result.turns[1].role).toBe("assistant");
  });

  it("should append [image: filename] for replies with image assets", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    // Turn 4 is an assistant reply with an image asset
    const turn4 = result.turns[3];
    expect(turn4.role).toBe("assistant");
    expect(turn4.content).toContain("ChatGPT said:Of course! Let me elaborate.");
    expect(turn4.content).toContain("[image: test.png]");
  });

  it("should use the asset filename in the image tag", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    const turn4 = result.turns[3];
    expect(turn4.content).toMatch(/\[image: test\.png\]$/);
  });

  it("should embed formatted replies in the markdown output", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.markdown).toContain("You said:Hello, how does this work?");
    expect(result.markdown).toContain("ChatGPT said:Hi! I'm doing well.");
    expect(result.markdown).toContain("[image: test.png]");
  });

  it("should embed formatted replies in the plain-text output", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.plainText).toContain("You said:Hello, how does this work?");
    expect(result.plainText).toContain("ChatGPT said:Hi! I'm doing well.");
    expect(result.plainText).toContain("[image: test.png]");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Suite 4 — scrapeChatGPT fast-path (mock chatgpt-share-parser)
// ─────────────────────────────────────────────────────────────────
describe("scrapeChatGPT fast-path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCircuitOpen.mockReturnValue(false);
    fetchChatGptShare.mockResolvedValue(mockShareResponse);
  });

  it("should return turns with correct role labels", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.turns).toHaveLength(4);
    expect(result.turns[0]).toMatchObject({ index: 1, role: "user" });
    expect(result.turns[1]).toMatchObject({ index: 2, role: "assistant" });
    expect(result.turns[2]).toMatchObject({ index: 3, role: "user" });
    expect(result.turns[3]).toMatchObject({ index: 4, role: "assistant" });
  });

  it("should return markdown output", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.markdown).toBeTruthy();
    expect(typeof result.markdown).toBe("string");
    expect(result.markdown).toContain("# ChatGPT Conversation Export");
    expect(result.markdown).toContain("### User (Turn 1)");
    expect(result.markdown).toContain("### Assistant (Turn 2)");
  });

  it("should return plain text output", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.plainText).toBeTruthy();
    expect(typeof result.plainText).toBe("string");
    expect(result.plainText).toContain("[User - Turn 1]");
    expect(result.plainText).toContain("[Assistant - Turn 2]");
  });

  it("should track elapsed time", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.elapsedSeconds).toBeDefined();
    expect(typeof result.elapsedSeconds).toBe("number");
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it("should set method to 'fastpath-parser'", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.method).toBe("fastpath-parser");
  });

  it("should call fetchChatGptShare with the share URL", async () => {
    const url = "https://chatgpt.com/share/abc123";
    await scrapeChatGPT(url);
    expect(fetchChatGptShare).toHaveBeenCalledWith(url);
  });

  it("should set scrapedAt to a valid ISO date string", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.scrapedAt).toBeDefined();
    expect(() => new Date(result.scrapedAt)).not.toThrow();
    expect(new Date(result.scrapedAt).toISOString()).toBe(result.scrapedAt);
  });

  it("should set totalTurns correctly", async () => {
    const result = await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(result.totalTurns).toBe(4);
  });

  it("should emit 'fastpath' progress phase at start", async () => {
    const onProgress = vi.fn();
    await scrapeChatGPT("https://chatgpt.com/share/test", onProgress);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "fastpath" })
    );
  });

  it("should emit 'done' progress phase on completion", async () => {
    const onProgress = vi.fn();
    await scrapeChatGPT("https://chatgpt.com/share/test", onProgress);
    const doneCalls = onProgress.mock.calls.filter(
      ([arg]) => arg.phase === "done"
    );
    expect(doneCalls.length).toBe(1);
    expect(doneCalls[0][0]).toMatchObject({ phase: "done" });
  });

  it("should call recordSuccess on fast-path success", async () => {
    await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(recordSuccess).toHaveBeenCalled();
  });

  it("should not call recordFailure on success", async () => {
    await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("should not call the Playwright fallback (getPage) on success", async () => {
    await scrapeChatGPT("https://chatgpt.com/share/test");
    expect(getPage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
//  Suite 5 — fast-path failure → Playwright fallback
// ─────────────────────────────────────────────────────────────────
describe("scrapeChatGPT fast-path failure → Playwright fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCircuitOpen.mockReturnValue(false);
    // Fast-path throws
    fetchChatGptShare.mockRejectedValue(new Error("Network error"));
    // Stub the fallback to fail without a real browser
    getPage.mockRejectedValue(new Error("No browser available"));
    releasePage.mockResolvedValue(undefined);
  });

  it("should attempt the fast-path and catch its error", async () => {
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test")
    ).rejects.toThrow();
    expect(fetchChatGptShare).toHaveBeenCalled();
  });

  it("should fall back to Playwright when fast-path fails", async () => {
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test")
    ).rejects.toThrow();
    // getPage is the first call inside playwrightFallback — proves it was attempted
    expect(getPage).toHaveBeenCalled();
  });

  it("should call recordFailure when fast-path fails", async () => {
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test")
    ).rejects.toThrow();
    expect(recordFailure).toHaveBeenCalled();
  });

  it("should NOT call recordSuccess when fast-path fails", async () => {
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test")
    ).rejects.toThrow();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it("should emit 'loading' phase when falling back to browser", async () => {
    const onProgress = vi.fn();
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test", onProgress)
    ).rejects.toThrow();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "loading" })
    );
  });

  it("should propagate the fallback error", async () => {
    getPage.mockRejectedValue(new Error("No browser available"));
    await expect(
      scrapeChatGPT("https://chatgpt.com/share/test")
    ).rejects.toThrow("No browser available");
  });
});

// ─────────────────────────────────────────────────────────────────
//  Suite 6 — Edge cases
// ─────────────────────────────────────────────────────────────────
describe("scrapeChatGPT edge cases", () => {
  describe("empty replies array (falls through to Playwright)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      isCircuitOpen.mockReturnValue(false);
      fetchChatGptShare.mockResolvedValue(mockEmptyShareResponse);
      getPage.mockRejectedValue(new Error("No browser"));
      releasePage.mockResolvedValue(undefined);
    });

    it("should fall through to Playwright when replies array is empty", async () => {
      await expect(
        scrapeChatGPT("https://chatgpt.com/share/empty")
      ).rejects.toThrow();
      expect(fetchChatGptShare).toHaveBeenCalled();
      expect(getPage).toHaveBeenCalled();
    });

    it("should not call recordSuccess for empty replies", async () => {
      await expect(
        scrapeChatGPT("https://chatgpt.com/share/empty")
      ).rejects.toThrow();
      expect(recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe("empty replies → Playwright finds 0 turns", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      isCircuitOpen.mockReturnValue(false);
      fetchChatGptShare.mockResolvedValue(mockEmptyShareResponse);
    });

    it("should return an empty result when Playwright finds no turns", async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(0), // 0 turns found
      };
      getPage.mockResolvedValue(mockPage);
      releasePage.mockResolvedValue(undefined);

      const result = await scrapeChatGPT("https://chatgpt.com/share/empty");

      expect(result.turns).toEqual([]);
      expect(result.markdown).toContain("# ChatGPT Conversation Export");
      expect(result.markdown).not.toContain("(Turn ");
      expect(result.plainText).toContain("ChatGPT Conversation Export");
      expect(result.plainText).not.toContain("[User");
      expect(result.totalTurns).toBe(0);
      expect(result.error).toBe("No turns found.");
      expect(result.method).toBe("playwright-fallback");
      expect(releasePage).toHaveBeenCalled();
    });
  });

  describe("very long conversation (50 turns)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      isCircuitOpen.mockReturnValue(false);
      fetchChatGptShare.mockResolvedValue(mockLargeShareResponse);
    });

    it("should process all 50 turns via fast-path", async () => {
      const result = await scrapeChatGPT("https://chatgpt.com/share/large");
      expect(result.totalTurns).toBe(50);
      expect(result.turns).toHaveLength(50);
      expect(result.method).toBe("fastpath-parser");
    });

    it("should produce markdown with all 50 turns", async () => {
      const result = await scrapeChatGPT("https://chatgpt.com/share/large");
      const turnHeaders = result.markdown.match(/\(Turn \d+\)/g);
      expect(turnHeaders).toHaveLength(50);
      expect(result.markdown).toContain("(Turn 50)");
    });

    it("should produce plain text with all 50 turns", async () => {
      const result = await scrapeChatGPT("https://chatgpt.com/share/large");
      const turnLabels = result.plainText.match(/\[.*? - Turn \d+\]/g);
      expect(turnLabels).toHaveLength(50);
      expect(result.plainText).toContain("[User - Turn 49]");
      expect(result.plainText).toContain("[Assistant - Turn 50]");
    });

    it("should correctly alternate user/assistant roles for all turns", async () => {
      const result = await scrapeChatGPT("https://chatgpt.com/share/large");
      for (let i = 0; i < result.turns.length; i++) {
        const expectedRole = i % 2 === 0 ? "user" : "assistant";
        expect(result.turns[i].role).toBe(expectedRole);
      }
    });

    it("should assign consecutive turn indices 1–50", async () => {
      const result = await scrapeChatGPT("https://chatgpt.com/share/large");
      for (let i = 0; i < result.turns.length; i++) {
        expect(result.turns[i].index).toBe(i + 1);
      }
    });
  });
});
