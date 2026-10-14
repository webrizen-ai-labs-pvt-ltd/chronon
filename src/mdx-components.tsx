import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Pre } from "@/components/docs";
import { Callout, Endpoint, Lead, ParamTable, RegionList } from "@/components/docs-blocks";

const components: MDXComponents = {
  a: ({ href = "", ...props }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noreferrer" {...props} />
    ),
  pre: Pre,
  Callout,
  Endpoint,
  Lead,
  ParamTable,
  RegionList,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
