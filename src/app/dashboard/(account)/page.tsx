import { AlertTriangle, BookOpen01, Key01, Signal01 } from "@untitledui/icons";
import Link from "next/link";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { Band } from "@/components/lattice";
import { listKeys, monthlyUsage } from "@/lib/accounts";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { maskKey } from "@/lib/keys";
import { isTier, MAX_ACTIVE_KEYS, tiers } from "@/lib/limits";
import { monthReset } from "@/lib/ratelimit";
import { apiBase } from "@/lib/site";
import { requireViewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";
import { CreateKey } from "./create-key";
import { RevokeForm } from "./revoke-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Layouts and pages render in parallel: when sign-in isn't configured the layout
  // shows a setup notice, and this page must not try to read a session.
  if (!ssoConfigured()) return null;
  const { user } = await requireViewer("/dashboard");
  const [keys, usage] = await Promise.all([listKeys(user.id), monthlyUsage([user.id])]);
  const tierId = isTier(user.tier) ? user.tier : "standard";
  const tier = tiers[tierId];
  const used = usage.get(user.id) ?? 0;
  const pct = Math.min(100, (used / tier.perMonth) * 100);
  const banned = Boolean(user.bannedAt);
  const atLimit = keys.length >= MAX_ACTIVE_KEYS;

  return (
    <>
      {/* Heading */}
      <Band dark>
        <div className="flex flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between md:py-16">
          <div className="flex flex-col gap-3">
            <p className="label text-mist-2">Dashboard</p>
            <h1 className="text-[44px] leading-[0.95] font-bold tracking-[-0.035em] sm:text-[60px]">
              {user.name ? `Hi, ${user.name.split(" ")[0]}.` : "Your API keys."}
            </h1>
            <p className="text-[17px] text-mist">
              Signed in as <span className="text-paper">{user.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/docs/quickstart" color="secondary" size="md" iconLeading={<BookOpen01 data-icon="leading" />}>
              Quickstart
            </Button>
          </div>
        </div>
        <div className="spectrum-rule" aria-hidden />
      </Band>

      {banned && (
        <Band>
          <div role="alert" className="flex gap-4 px-5 py-6 sm:px-8">
            <FeaturedIcon icon={AlertTriangle} theme="light" color="error" size="md" />
            <div className="text-[17px]">
              <p className="font-bold">Account suspended</p>
              <p className="text-ink-2">
                This account was suspended for breaking the{" "}
                <Link href="/docs/limits#fair-use" className="underline">
                  fair-use policy
                </Link>
                {user.banReason ? `: ${user.banReason}` : "."} Your keys don&apos;t work while it&apos;s suspended.
              </p>
            </div>
          </div>
        </Band>
      )}

      {/* Usage */}
      <Band>
        <div className="cells grid-cols-1 md:grid-cols-[2fr_1fr_1fr]" aria-label="Usage">
          <div data-prism className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="label text-slate">Requests this month</p>
              <p className="label text-slate">Resets {formatDate(new Date(monthReset()))}</p>
            </div>
            <p className="text-[48px] leading-none font-bold tracking-[-0.035em]">
              {formatNumber(used)}
              <span className="text-[22px] font-normal tracking-normal text-slate"> / {formatNumber(tier.perMonth)}</span>
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Monthly quota used"
            >
              <div className="h-full rounded-full bg-ion" style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
            </div>
          </div>
          <div data-prism className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="label text-slate">Rate limit</p>
              <Badge type="modern" color="gray" size="sm">
                {tier.label}
              </Badge>
            </div>
            <p className="text-[48px] leading-none font-bold tracking-[-0.035em]">
              {tier.perMinute}
              <span className="text-[22px] font-normal tracking-normal text-slate"> / min</span>
            </p>
            <Link href="/docs/limits" className="mt-auto self-start text-[16px] underline">
              How limits work
            </Link>
          </div>
          <div data-prism className="flex flex-col gap-4 p-6 sm:p-8">
            <p className="label text-slate">Base URL</p>
            <code className="font-mono text-[14px] break-all">{apiBase}</code>
            <p className="mt-auto text-[15px] text-slate">Send keys as <code className="font-mono text-[12px]">Authorization: Bearer</code>.</p>
          </div>
        </div>
      </Band>

      {/* Keys */}
      <Band>
        <div className="section-head flex flex-col gap-6 px-5 py-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FeaturedIcon icon={Key01} theme="modern" color="gray" size="md" />
              <h2 className="text-[30px] leading-none font-bold tracking-[-0.03em]">API keys</h2>
            </div>
            <BadgeWithDot type="modern" color={atLimit ? "warning" : "gray"} size="md">
              {keys.length} / {MAX_ACTIVE_KEYS} active
            </BadgeWithDot>
          </div>
          <CreateKey
            disabled={banned || atLimit}
            disabledReason={atLimit && !banned ? `You have ${MAX_ACTIVE_KEYS} active keys. Revoke one to create another.` : undefined}
          />
        </div>

        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <FeaturedIcon icon={Signal01} theme="modern" color="gray" size="lg" />
            <p className="text-[22px] font-bold tracking-[-0.02em]">No keys yet</p>
            <p className="max-w-[420px] text-[16px] text-slate">
              Create one above, then follow the{" "}
              <Link href="/docs/quickstart" className="text-night underline">
                quickstart
              </Link>{" "}
              to make your first request.
            </p>
          </div>
        ) : (
          <ul className="cells grid-cols-1">
            {keys.map((k) => (
              <li key={k.id} data-prism className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-[19px] font-bold">{k.name}</p>
                  <code className="font-mono text-[13px] text-slate">{maskKey(k.id)}</code>
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <dl className="grid grid-cols-2 gap-x-8 font-mono text-[12px]">
                    <dt className="text-slate">Created</dt>
                    <dt className="text-slate">Last used</dt>
                    <dd>{formatDate(k.createdAt)}</dd>
                    <dd>{timeAgo(k.lastUsedAt)}</dd>
                  </dl>
                  <RevokeForm id={k.id} name={k.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Band>
    </>
  );
}
