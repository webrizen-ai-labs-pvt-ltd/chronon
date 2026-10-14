import Link from "next/link";
import { listKeys, monthlyUsage } from "@/lib/accounts";
import { maskKey } from "@/lib/keys";
import { isTier, MAX_ACTIVE_KEYS, tiers } from "@/lib/limits";
import { monthReset } from "@/lib/ratelimit";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { revokeKeyAction } from "./actions";
import { CreateKey } from "./create-key";
import { RevokeButton } from "./revoke-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireViewer("/dashboard");
  const [keys, usage] = await Promise.all([listKeys(user.id), monthlyUsage([user.id])]);
  const tier = tiers[isTier(user.tier) ? user.tier : "standard"];
  const used = usage.get(user.id) ?? 0;
  const pct = Math.min(100, (used / tier.perMonth) * 100);
  const banned = Boolean(user.bannedAt);
  const atLimit = keys.length >= MAX_ACTIVE_KEYS;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-4 py-12 sm:px-[22px] md:py-16">
      <div className="flex flex-col gap-3">
        <p className="label text-slate">Dashboard</p>
        <h1 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">
          {user.name ? `Hi, ${user.name.split(" ")[0]}.` : "Your API keys."}
        </h1>
      </div>

      {banned && (
        <div role="alert" className="rounded-md border border-photon/50 bg-card px-5 py-4 text-[17px]">
          <p className="label mb-1 text-photon">Account suspended</p>
          This account was suspended for breaking the{" "}
          <Link href="/docs/limits#fair-use" className="underline">
            fair-use policy
          </Link>
          {user.banReason ? `: ${user.banReason}` : "."} Your keys don&apos;t work while it&apos;s suspended.
        </div>
      )}

      {/* Usage */}
      <section className="grid gap-4 md:grid-cols-3" aria-label="Usage">
        <div className="flex flex-col gap-3 rounded-md border border-line-light bg-card p-5 md:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="label text-slate">Requests this month</p>
            <p className="label text-slate">Resets {formatDate(new Date(monthReset()))}</p>
          </div>
          <p className="text-[44px] leading-none font-bold tracking-[-0.035em]">
            {formatNumber(used)}
            <span className="text-[22px] font-normal tracking-normal text-slate"> / {formatNumber(tier.perMonth)}</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-line-light" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly quota used">
            <div className="h-full rounded-full bg-ion" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-line-light bg-card p-5">
          <p className="label text-slate">{tier.label} tier</p>
          <p className="text-[44px] leading-none font-bold tracking-[-0.035em]">
            {tier.perMinute}
            <span className="text-[22px] font-normal tracking-normal text-slate"> / min</span>
          </p>
          <Link href="/docs/limits" className="mt-auto self-start text-[16px] underline">
            How limits work
          </Link>
        </div>
      </section>

      {/* Keys */}
      <section className="flex flex-col gap-6" aria-labelledby="keys-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="keys-heading" className="text-[32px] leading-none font-bold tracking-[-0.03em]">
            API keys
          </h2>
          <p className="label text-slate">
            {keys.length} / {MAX_ACTIVE_KEYS} active
          </p>
        </div>

        <CreateKey
          disabled={banned || atLimit}
          disabledReason={atLimit && !banned ? `You have ${MAX_ACTIVE_KEYS} active keys. Revoke one to create another.` : undefined}
        />

        {keys.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-light p-6 text-[17px] text-slate">
            No keys yet. Create one above, then follow the{" "}
            <Link href="/docs/quickstart" className="text-night underline">
              quickstart
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line-light rounded-md border border-line-light bg-card">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-[18px] font-bold">{k.name}</p>
                  <code className="font-mono text-[13px] text-slate">{maskKey(k.id)}</code>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <dl className="grid grid-cols-2 gap-x-6 font-mono text-[12px]">
                    <dt className="text-slate">Created</dt>
                    <dt className="text-slate">Last used</dt>
                    <dd>{formatDate(k.createdAt)}</dd>
                    <dd>{timeAgo(k.lastUsedAt)}</dd>
                  </dl>
                  <form action={revokeKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <RevokeButton name={k.name} />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
