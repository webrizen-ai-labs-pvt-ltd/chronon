import { ChrononMark } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { ContinueToWebrizen } from "./continue";

export const metadata = { title: "Sign in", robots: { index: false } };

/** Only same-site paths, so the sign-in flow can't be used as an open redirect. */
function safeReturnTo(raw: string | undefined) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const href = `/api/auth/webrizen/login?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <>
      <SiteHeader tag="dashboard" />
      <main className="grid min-h-[70dvh] place-items-center bg-paper px-5 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-5 rounded-xl border border-line-light bg-card p-8 text-center shadow-xs">
          <ChrononMark size={40} ink="var(--color-night)" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-night">Signing you in</h1>
            <p className="text-[14.5px] text-slate">Taking you to Webrizen to continue.</p>
          </div>
          <a href={href} className="text-[14px] font-semibold text-ion no-underline hover:underline">
            Continue with Webrizen
          </a>
          <ContinueToWebrizen href={href} />
        </div>
      </main>
    </>
  );
}
