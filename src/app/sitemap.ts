import type { MetadataRoute } from "next";
import { allDocPages } from "@/lib/docs/nav";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", ...allDocPages.map((p) => p.href)].map((path) => ({ url: `${site.url}${path}` }));
}
