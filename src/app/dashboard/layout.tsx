import Link from "next/link";
import { Button } from "@/components/base/buttons/button";
import { Band } from "@/components/lattice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SignOutLink } from "@/components/sign-out-link";
import { getViewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";

export const metadata = { title: { default: "Dashboard", template: "%s · Chronon" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!ssoConfigured()) {
    return (
      <>
        <SiteHeader tag="dashboard" primary={false} />
        <Band>
          <div className="flex min-h-[60dvh] max-w-[760px] flex-col justify-center gap-5 px-5 py-20 sm:px-8">
            <p className="label text-slate">Setup needed</p>
            <h1 className="text-5xl leading-none font-bold tracking-[-0.035em]">Sign-in isn&apos;t configured.</h1>
            <p className="text-[19px] leading-normal text-ink-2">
              The dashboard signs people in with Webrizen SSO. Set the <code className="font-mono text-[14px]">WEBRIZEN_SSO_*</code>{" "}
              variables in <code className="font-mono text-[14px]">.env</code>, or create a local key with{" "}
              <code className="font-mono text-[14px]">pnpm dev:key</code> to work on the API without it.
            </p>
            <Button href="/docs/contributing" color="secondary" size="md" className="self-start">
              Local setup guide
            </Button>
          </div>
        </Band>
        <SiteFooter />
      </>
    );
  }

  const viewer = await getViewer();
  return (
    <>
      <SiteHeader
        tag="dashboard"
        right={
          viewer ? (
            <div className="flex items-center gap-4 text-[15px] text-mist">
              {viewer.isAdmin && (
                <Link href="/dashboard/admin" className="no-underline transition hover:text-paper">
                  Admin
                </Link>
              )}
              <SignOutLink />
            </div>
          ) : undefined
        }
      />
      <main className="min-h-[70dvh]">{children}</main>
      <SiteFooter />
    </>
  );
}
