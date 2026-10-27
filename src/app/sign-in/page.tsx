import { ChrononMark } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { ContinueToWebrizen } from "./continue";

export const metadata = { title: "Sign in", robots: { index: false } };

/** Only same-site paths, so the sign-in flow can't be used as an open redirect. */
function safeReturnTo(raw: string | undefined) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";
}

/** What went wrong, in words, for the `webrizen_error` codes the SSO SDK sends back. */
const errors: Record<string, { title: string; body: string }> = {
  access_denied: { title: "Sign-in was cancelled", body: "You can try again whenever you're ready." },
  login_expired: { title: "That sign-in took too long", body: "Start again and it'll only take a moment." },
  login_failed: { title: "We couldn't finish signing you in", body: "Please try again. If it keeps happening, let us know." },
  sso_unavailable: { title: "Webrizen sign-in is unavailable", body: "We couldn't reach Webrizen. Try again in a minute." },
  forbidden: { title: "You don't have access to that page", body: "Sign in with an account that has access, or go back to your dashboard." },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; webrizen_error?: string }> }) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(sp.returnTo);
  const href = `/api/auth/webrizen/login?returnTo=${encodeURIComponent(returnTo)}`;
  // After an error, wait for a click instead of bouncing straight back to Webrizen (which could loop).
  const error = sp.webrizen_error ? (errors[sp.webrizen_error] ?? errors.login_failed) : null;
  return (
    <>
      <SiteHeader tag="dashboard" />
      <main className="grid min-h-[70dvh] place-items-center bg-paper px-5 py-16">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-5 rounded-xl border border-line-light bg-card p-8 text-center shadow-xs">
          <ChrononMark size={40} ink="var(--color-night)" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-night">{error ? error.title : "Signing you in"}</h1>
            <p className="text-[14.5px] text-slate">{error ? error.body : "Taking you to Webrizen to continue."}</p>
          </div>
          <a href={href} className="text-[14px] font-semibold text-ion no-underline hover:underline">
            {error ? "Try again" : "Continue with Webrizen"}
          </a>
          {!error && <ContinueToWebrizen href={href} />}
        </div>
      </main>
    </>
  );
}
