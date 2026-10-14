import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import chrononTheme from "./src/lib/docs/shiki-theme.json";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  poweredByHeader: false,
  // Public API paths are /v1/*; the handlers live under app/api/v1.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }];
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
