export type DocPage = { title: string; href: string };
export type DocSection = { title: string; pages: DocPage[] };

export const docsNav: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      { title: "Introduction", href: "/docs" },
      { title: "Quickstart", href: "/docs/quickstart" },
    ],
  },
  {
    title: "Using the API",
    pages: [
      { title: "Authentication", href: "/docs/authentication" },
      { title: "Limits & fair use", href: "/docs/limits" },
      { title: "Errors", href: "/docs/errors" },
    ],
  },
  {
    title: "API reference",
    pages: [{ title: "Regional menus", href: "/docs/api/menus" }],
  },
  {
    title: "Open source",
    pages: [
      { title: "Contributing", href: "/docs/contributing" },
      { title: "Deployment", href: "/docs/deployment" },
    ],
  },
];

export const allDocPages = docsNav.flatMap((s) => s.pages);
