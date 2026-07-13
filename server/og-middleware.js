export function ogMiddleware(baseUrl) {
  const imageUrl = `${baseUrl}/og-image.svg`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChatGPT Exporter by Pactis — Extract, Export, Archive</title>
    <meta name="description" content="Paste any ChatGPT share link — get the full conversation as Markdown, JSON, or plain text. Free tool by Pactis." />

    <meta property="og:title" content="ChatGPT Exporter by Pactis" />
    <meta property="og:description" content="Paste any ChatGPT share link — get the full conversation as Markdown, JSON, or plain text. Free, open-source." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pactis" />
    <meta property="og:url" content="${baseUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/svg+xml" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="ChatGPT Exporter by Pactis" />
    <meta name="twitter:description" content="Paste any ChatGPT share link — get the full conversation." />
    <meta name="twitter:image" content="${imageUrl}" />

    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%236C5CE7'/><path d='M8 16l6 6L24 10' stroke='%23f5f5f5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>" />
  </head>
  <body class="bg-[#0a0a0a] text-[#f5f5f5] min-h-screen">
    <div id="root"></div>
    <script type="module" src="/assets/OG_ASSETS_PLACEHOLDER"></script>
    <link rel="stylesheet" href="/assets/OG_CSS_PLACEHOLDER" />
  </body>
</html>`;
}
