export function formatMarkdown(turns) {
  let md = "# ChatGPT Conversation Export\n\n*Exported by ChatGPT Exporter by Pactis*\n\n---\n\n";
  for (const t of turns) {
    const rl = t.role === "assistant" ? "### Assistant" : "### User";
    md += `${rl} (Turn ${t.index})\n\n${t.content}\n\n---\n\n`;
  }
  return md;
}

export function formatText(turns) {
  let text = "ChatGPT Conversation Export\n==========================\n\n";
  for (const t of turns) {
    const lbl = t.role === "assistant" ? "Assistant" : "User";
    text += `[${lbl} - Turn ${t.index}]\n${t.content}\n\n---\n\n`;
  }
  return text;
}
