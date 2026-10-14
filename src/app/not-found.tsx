import { ArrowLeft, BookOpen01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ChrononMark } from "@/components/brand";
import { Band } from "@/components/lattice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <Band>
        <div data-prism className="flex min-h-[65dvh] flex-col items-start justify-center gap-6 px-5 py-20 sm:px-8">
          <ChrononMark size={72} ink="var(--color-night)" core="var(--color-night)" />
          <p className="label text-slate">404</p>
          <h1 className="text-5xl leading-none font-bold tracking-[-0.035em]">Nothing at this address.</h1>
          <p className="max-w-[520px] text-[19px] text-ink-2">
            The page moved or never existed. Looking for an endpoint? API paths start with{" "}
            <code className="font-mono text-[15px]">/v1</code>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/" color="secondary" size="md" iconLeading={<ArrowLeft data-icon="leading" />}>
              Home
            </Button>
            <Button href="/docs" color="link-color" size="md" iconLeading={<BookOpen01 data-icon="leading" />}>
              Documentation
            </Button>
          </div>
        </div>
      </Band>
      <SiteFooter />
    </>
  );
}
