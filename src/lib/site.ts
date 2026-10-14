/** Public facts about this deployment, used across pages, docs and API responses. */
export const site = {
  org: "Webrizen AI Labs",
  url: (process.env.APP_URL ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/webrizen-ai-labs-pvt-ltd/chronon",
} as const;

/** Base URL developers call, e.g. https://chronon.webrizen.com/v1 */
export const apiBase = `${site.url}/v1`;
