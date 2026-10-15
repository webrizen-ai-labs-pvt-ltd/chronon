import { Users01 } from "@untitledui/icons";
import { Card, EmptyState, PageHeader, StatePill, Table, tdCls, thCls } from "@/components/admin/kit";
import { monthlyUsage, searchUsers } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { tiers } from "@/lib/limits";
import { SuspendButton, TierSelect } from "./account-controls";
import { AdminSearchInput } from "./search-input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts" };

function initials(name: string | null, email: string) {
  return (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireAdmin("/dashboard/admin/accounts");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await searchUsers(q);
  const usage = await monthlyUsage(rows.map((r) => r.id));
  const tierList = Object.entries(tiers).map(([id, t]) => ({ id, label: t.label }));

  return (
    <>
      <PageHeader title="Accounts" description="Developers with a Chronon account. Tier and suspension changes reach the API within a minute." actions={<AdminSearchInput defaultValue={q} />} />

      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState icon={<Users01 />} title={q ? "No matching accounts" : "No accounts yet"} description={q ? `Nothing matches "${q}".` : "Accounts appear when developers sign in."} />
        ) : (
          <Table minWidth={900}>
            <thead>
              <tr>
                <th className={thCls}>Account</th>
                <th className={`${thCls} text-right`}>Keys</th>
                <th className={`${thCls} text-right`}>This month</th>
                <th className={thCls}>Last seen</th>
                <th className={thCls}>Tier</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`} />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const self = u.id === viewer.user.id;
                return (
                  <tr key={u.id} className="transition hover:bg-paper/50">
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 font-mono text-[11.5px] text-ink-2 ring-1 ring-neutral-200">{initials(u.name, u.email)}</span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-bold text-night">
                            {u.name ?? u.email.split("@")[0]}
                            {self && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-normal text-slate">You</span>}
                          </span>
                          <span className="truncate text-[13px] text-slate" title={`Joined ${formatDate(u.createdAt)}`}>
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>{u.activeKeys}</td>
                    <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>{formatNumber(usage.get(u.id) ?? 0)}</td>
                    <td className={`${tdCls} whitespace-nowrap text-slate`}>{timeAgo(u.lastSeenAt)}</td>
                    <td className={tdCls}>
                      <TierSelect userId={u.id} tier={u.tier} tiers={tierList} />
                    </td>
                    <td className={tdCls}>
                      {u.bannedAt ? (
                        <span className="flex flex-col gap-1">
                          <StatePill state="disabled" label="Suspended" className="self-start" />
                          {u.banReason && <span className="max-w-[220px] truncate text-[12.5px] text-slate" title={u.banReason}>{u.banReason}</span>}
                        </span>
                      ) : (
                        <StatePill state="active" />
                      )}
                    </td>
                    <td className={`${tdCls} text-right`}>{!self && <SuspendButton userId={u.id} email={u.email} banned={Boolean(u.bannedAt)} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
