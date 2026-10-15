import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import chrononTheme from "./src/lib/docs/shiki-theme.json";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  poweredByHeader: false,
  // The dev server only trusts localhost by default; we develop on 127.0.0.1 (see src/proxy.ts),
  // and without this its HMR socket is refused and pages never hydrate.
  allowedDevOrigins: ["127.0.0.1"],
  images: { qualities: [75, 80] },
  // Builder imports send up to a few MB of records; Vercel caps bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // Public API paths are /v1/*, /v2/*…; the handlers live under app/api.
  async rewrites() {
    return [{ source: "/:version(v\\d{1,3})/:path*", destination: "/api/:version/:path*" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: chrononTheme, keepBackground: false, defaultLang: "plaintext" }],
    ],
  },
});

export default withMDX(nextConfig);
