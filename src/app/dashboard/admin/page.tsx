import { Activity, ArrowRight, CheckCircle, Database01, Plus, Server01, Users01 } from "@untitledui/icons";
import { count, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { Card, PageHeader, Sparkbars, Stat, StatePill, Table, tdCls, thCls } from "@/components/admin/kit";
import { MigrateNotice } from "@/components/admin/migrate-notice";
import { Button } from "@/components/base/buttons/button";
import { requireAdmin } from "@/lib/admin";
import { builderReady, listApis, listAudit } from "@/lib/builder/repo";
import { apiUsage } from "@/lib/builder/serve";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatNumber, timeAgo } from "@/lib/format";
import { cx } from "@/utils/cx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function Delta({ now, before }: { now: number; before: number }) {
  if (!now && !before) return null;
  const pct = before ? Math.round(((now - before) / before) * 100) : 100;
  const up = pct >= 0;
  return (
    <span className={cx("rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums", up ? "bg-[#e9f7ef] text-[#17663a]" : "bg-[#fdecec] text-[#a12b2b]")}>
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export default async function AdminOverview() {
  const viewer = await requireAdmin("/dashboard/admin");
  const ready = await builderReady();
  const [list, activity, [{ accounts }], [{ fresh }]] = await Promise.all([
    ready ? listApis() : Promise.resolve([]),
    ready ? listAudit({ limit: 8 }) : Promise.resolve([]),
    getDb().select({ accounts: count() }).from(users),
    getDb().select({ fresh: count() }).from(users).where(gte(users.createdAt, sql`now() - interval '7 days'`)),
  ]);

  const menusBuiltIn = !list.some((a) => a.slug === "menus");
  const slugs = [...list.map((a) => a.slug), ...(menusBuiltIn ? ["menus"] : [])];
  const usage = await apiUsage(slugs, 14);
  const daily = Array.from({ length: 14 }, (_, i) => sum([...usage.values()].map((d) => d[i]?.count ?? 0)));
  const thisWeek = sum(daily.slice(7));
  const lastWeek = sum(daily.slice(0, 7));
  const isLive = (a: (typeof list)[number]) => a.status === "active" && a.versions.some((v) => v.state === "published" || v.state === "deprecated");
  const live = list.filter(isLive).length + (menusBuiltIn ? 1 : 0);
  const drafts = list.filter((a) => a.versions.some((v) => v.state === "draft")).length;
  const records = sum(list.map((a) => a.records));
  const firstName = viewer.user.name?.split(" ")[0];

  const steps = [
    { done: !menusBuiltIn, label: "Import Regional menus", hint: "Move the built-in API into the builder so it's editable here.", href: "/dashboard/admin/apis" },
    { done: list.some((a) => a.slug !== "menus"), label: "Create your first API", hint: "A dataset you curate, or a ready-made utility block.", href: "/dashboard/admin/apis/new" },
    { done: list.some((a) => a.slug !== "menus" && isLive(a)), label: "Publish it", hint: "Test in the playground, then make v1 live.", href: "/dashboard/admin/apis" },
  ];
  const onboarding = steps.some((s) => !s.done);

  return (
    <>
      <PageHeader
        title={firstName ? `Good to see you, ${firstName}` : "Overview"}
        description="Everything Chronon serves, at a glance."
        actions={
          <Button href="/dashboard/admin/apis/new" size="md" iconLeading={<Plus data-icon="leading" />}>
            New API
          </Button>
        }
      />

      {!ready && <MigrateNotice />}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Requests, last 7 days"
          icon={<Activity />}
          value={formatNumber(thisWeek)}
          trend={<Sparkbars values={daily} height={30} />}
          hint={
            <span className="flex items-center gap-2">
              <Delta now={thisWeek} before={lastWeek} /> vs the 7 days before
            </span>
          }
        />
        <Stat label="Live APIs" icon={<Server01 />} value={formatNumber(live)} hint={drafts ? `${drafts} with a draft in progress` : "No drafts in progress"} />
        <Stat label="Records" icon={<Database01 />} value={formatNumber(records)} hint="Across every dataset version" />
        <Stat label="Accounts" icon={<Users01 />} value={formatNumber(accounts)} hint={fresh ? `${formatNumber(fresh)} joined this week` : "None new this week"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title="APIs"
          description="Traffic per API over the last 14 days"
          actions={
            <Button href="/dashboard/admin/apis" size="sm" color="tertiary" iconTrailing={<ArrowRight data-icon="trailing" />}>
              View all
            </Button>
          }
          bodyClassName="p-0"
        >
          <Table minWidth={560}>
            <thead>
              <tr>
                <th className={thCls}>API</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Trend</th>
                <th className={`${thCls} text-right`}>7 days</th>
              </tr>
            </thead>
            <tbody>
              {menusBuiltIn && (
                <tr className="transition hover:bg-paper/60">
                  <td className={tdCls}>
                    <Link href="/dashboard/admin/apis" className="flex flex-col no-underline">
                      <span className="font-bold text-night">Regional menus</span>
                      <span className="font-mono text-[12px] text-slate">/v1/menus</span>
                    </Link>
                  </td>
                  <td className={tdCls}>
                    <StatePill state="builtin" label="Built-in" />
                  </td>
                  <td className={tdCls}>
                    <Sparkbars values={(usage.get("menus") ?? []).map((d) => d.count)} />
                  </td>
                  <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>{formatNumber(sum((usage.get("menus") ?? []).slice(-7).map((d) => d.count)))}</td>
                </tr>
              )}
              {list.map((a) => {
                const days = usage.get(a.slug) ?? [];
                const latest = a.versions[a.versions.length - 1];
                return (
                  <tr key={a.id} className="transition hover:bg-paper/60">
                    <td className={tdCls}>
                      <Link href={`/dashboard/admin/apis/${a.slug}`} className="flex flex-col no-underline">
                        <span className="font-bold text-night hover:text-ion">{a.name}</span>
                        <span className="font-mono text-[12px] text-slate">
                          /v{latest?.version ?? 1}/{a.slug}
                        </span>
                      </Link>
                    </td>
                    <td className={tdCls}>
                      <StatePill state={a.status === "disabled" ? "disabled" : (latest?.state ?? "draft")} />
                    </td>
                    <td className={tdCls}>
                      <Sparkbars values={days.map((d) => d.count)} />
                    </td>
                    <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>{formatNumber(sum(days.slice(-7).map((d) => d.count)))}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <div className="flex flex-col gap-6">
          {onboarding && (
            <Card title="Get started" description={`${steps.filter((s) => s.done).length} of ${steps.length} done`}>
              <ol className="flex flex-col gap-1">
                {steps.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className={cx("flex gap-3 rounded-lg p-2.5 no-underline transition", !s.done && "hover:bg-paper")}>
                      {s.done ? (
                        <CheckCircle className="mt-0.5 size-5 shrink-0 text-[#22a05a]" />
                      ) : (
                        <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-neutral-300" aria-hidden />
                      )}
                      <span className="flex flex-col gap-0.5">
                        <span className={cx("text-[14px] font-bold", s.done ? "text-slate line-through decoration-neutral-300" : "text-night")}>{s.label}</span>
                        {!s.done && <span className="text-[13px] text-slate">{s.hint}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card
            title="Recent activity"
            actions={
              <Link href="/dashboard/admin/activity" className="text-[13.5px] font-bold text-ion no-underline hover:underline">
                View all
              </Link>
            }
          >
            {activity.length === 0 ? (
              <p className="py-4 text-center text-[14px] text-slate">Changes made in the builder show up here.</p>
            ) : (
              <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-neutral-200">
                {activity.map((e) => (
                  <li key={e.id} className="relative flex gap-3.5 pl-0">
                    <span className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card bg-ion ring-1 ring-neutral-200" aria-hidden />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-[14px] leading-snug text-night">{e.summary}</p>
                      <p className="truncate text-[12.5px] text-slate">
                        <span className="font-mono">
                          {e.apiSlug}
                          {e.version ? ` v${e.version}` : ""}
                        </span>{" "}
                        · {timeAgo(e.createdAt)} · {e.actor}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
