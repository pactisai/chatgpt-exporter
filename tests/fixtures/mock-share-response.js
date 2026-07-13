export const mockShareResponse = {
  shareId: "abc123def456",
  aiModel: "gpt-4",
  title: "Test Conversation",
  updatedAt: Date.now(),
  replies: [
    { authorName: "User", type: "user", statement: "Hello, how does this work?", createdAt: Date.now(), assets: [] },
    { authorName: "ChatGPT", type: "assistant", statement: "Hi! I'm doing well.", createdAt: Date.now(), assets: [] },
    { authorName: "User", type: "user", statement: "Can you explain more?", createdAt: Date.now(), assets: [] },
    { authorName: "ChatGPT", type: "assistant", statement: "Of course! Let me elaborate.", createdAt: Date.now(), assets: [{ assetType: "image", filename: "test.png", url: "https://example.com/test.png" }] },
  ],
};

export const mockEmptyShareResponse = {
  shareId: "empty123",
  aiModel: "gpt-4",
  title: "Empty",
  updatedAt: Date.now(),
  replies: [],
};

export const mockLargeShareResponse = {
  shareId: "large123",
  aiModel: "gpt-4",
  title: "Large Conversation",
  updatedAt: Date.now(),
  replies: Array.from({ length: 50 }, (_, i) => ({
    authorName: i % 2 === 0 ? "User" : "ChatGPT",
    type: i % 2 === 0 ? "user" : "assistant",
    statement: `Turn ${i + 1} content here. `.repeat(10),
    createdAt: Date.now(),
    assets: [],
  })),
};
