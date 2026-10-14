import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getViewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";

export const metadata = { title: { default: "Dashboard", template: "%s · Chronon" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!ssoConfigured()) {
    return (
      <>
        <SiteHeader tag="dashboard" primary={false} />
        <main className="mx-auto flex min-h-[60dvh] max-w-[760px] flex-col gap-5 px-4 py-20">
          <p className="label text-slate">Setup needed</p>
          <h1 className="text-5xl leading-none font-bold tracking-[-0.035em]">Sign-in isn&apos;t configured.</h1>
          <p className="text-[19px] leading-normal text-ink-2">
            The dashboard signs people in with Webrizen SSO. Set the <code className="font-mono text-[14px]">WEBRIZEN_SSO_*</code>{" "}
            variables in <code className="font-mono text-[14px]">.env</code>, or create a local key with{" "}
            <code className="font-mono text-[14px]">pnpm dev:key</code> to work on the API without it.
          </p>
          <Link href="/docs/contributing" className="self-start text-[17px] underline">
            Local setup guide
          </Link>
        </main>
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
            <div className="flex items-center gap-4 text-[15px] text-mist max-sm:ml-auto">
              {viewer.isAdmin && (
                <Link href="/dashboard/admin" className="no-underline hover:text-paper">
                  Admin
                </Link>
              )}
              <span className="hidden max-w-[220px] truncate text-mist-2 sm:inline" title={viewer.user.email}>
                {viewer.user.email}
              </span>
              {/* A route handler, not a page: it needs a full navigation, so <Link> would be wrong. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/auth/webrizen/logout" className="btn btn-outline-dark">
                Sign out
              </a>
            </div>
          ) : undefined
        }
      />
      <main className="min-h-[70dvh]">{children}</main>
      <SiteFooter />
    </>
  );
}
