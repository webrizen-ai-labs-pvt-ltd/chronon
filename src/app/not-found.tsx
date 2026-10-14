import Link from "next/link";
import { ChrononMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[65dvh] max-w-[760px] flex-col items-start justify-center gap-6 px-4 py-20">
        <ChrononMark size={72} ink="var(--color-night)" core="var(--color-night)" />
        <p className="label text-slate">404</p>
        <h1 className="text-5xl leading-none font-bold tracking-[-0.035em]">Nothing at this address.</h1>
        <p className="text-[19px] text-ink-2">
          The page moved or never existed. Looking for an endpoint? API paths start with{" "}
          <code className="font-mono text-[15px]">/v1</code>.
        </p>
        <div className="flex gap-4 text-[17px]">
          <Link href="/" className="underline">
            Home
          </Link>
          <Link href="/docs" className="underline">
            Docs
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
