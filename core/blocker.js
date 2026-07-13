export async function installResourceBlockers(page) {
  await page.route("**/*.{woff,woff2,ttf,mp4,webm}", (route) => route.abort());
  await page.route("**/google-analytics.com/**", (route) => route.abort());
  await page.route("**/googletagmanager.com/**", (route) => route.abort());
  await page.route("**/segment.io/**", (route) => route.abort());
  await page.route("**/cdn.helpscout.net/**", (route) => route.abort());
  await page.route("**/bat.bing.com/**", (route) => route.abort());
  await page.route("**/clarity.ms/**", (route) => route.abort());
  await page.route("**/api.oaistatsig.com/**", (route) => route.abort());
}
