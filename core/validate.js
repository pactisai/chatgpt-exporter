export function isValidShareUrl(input) {
  try {
    const u = new URL(input.trim());
    return (
      (u.hostname === "chatgpt.com" || u.hostname === "chat.openai.com") &&
      u.pathname.startsWith("/share/") &&
      u.protocol === "https:"
    );
  } catch {
    return false;
  }
}
