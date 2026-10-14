import Link from "next/link";
import { ChrononMark } from "@/components/brand";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line-dark bg-night text-mist-2">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-[22px]">
        <div className="flex items-center gap-3">
          <ChrononMark size={22} ink="var(--color-paper)" />
          <span className="text-[15px]">
            Chronon by {site.org}. Free, open source,{" "}
            <a href={`${site.repoUrl}/blob/main/LICENSE`} className="text-mist hover:text-paper">
              MIT
            </a>
            .
          </span>
        </div>
        <nav className="label flex flex-wrap gap-x-5 gap-y-2 text-mist-2">
          <Link href="/docs" className="no-underline hover:text-paper">
            Docs
          </Link>
          <Link href="/docs/limits" className="no-underline hover:text-paper">
            Fair use
          </Link>
          <Link href="/dashboard" className="no-underline hover:text-paper">
            Dashboard
          </Link>
          <a href={site.repoUrl} target="_blank" rel="noreferrer" className="no-underline hover:text-paper">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
