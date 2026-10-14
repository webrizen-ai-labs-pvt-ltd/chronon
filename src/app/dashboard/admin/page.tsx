import { notFound } from "next/navigation";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Band } from "@/components/lattice";
import { monthlyUsage, searchUsers } from "@/lib/accounts";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { tiers } from "@/lib/limits";
import { requireViewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";
import { setBannedAction, setTierAction } from "./actions";
import { AdminSearchInput } from "./search-input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  // Layouts and pages render in parallel: when sign-in isn't configured the layout
  // shows a setup notice, and this page must not try to read a session.
  if (!ssoConfigured()) return null;
  const viewer = await requireViewer("/dashboard/admin");
  if (!viewer.isAdmin) notFound();

  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await searchUsers(q);
  const usage = await monthlyUsage(rows.map((r) => r.id));

  return (
    <Band>
      <div className="flex flex-col gap-8 px-5 py-12 sm:px-8 md:py-16">
        <div className="flex flex-col gap-3">
          <p className="label text-slate">Admin</p>
          <h1 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">Accounts</h1>
          <p className="text-[17px] text-ink-2">Change tiers or suspend accounts. Changes reach the API within a minute.</p>
        </div>

        <form className="flex gap-3" role="search">
          <label htmlFor="q" className="sr-only">
            Search by email or name
          </label>
          <AdminSearchInput defaultValue={q} />
          <Button type="submit" color="secondary" size="md">
            Search
          </Button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-line-light bg-card">
          <table className="w-full min-w-[880px] text-left text-[15px]">
            <thead className="label text-slate">
              <tr className="border-b border-line-light">
                <th className="px-4 py-3 font-normal">Account</th>
                <th className="px-4 py-3 font-normal">Keys</th>
                <th className="px-4 py-3 font-normal">This month</th>
                <th className="px-4 py-3 font-normal">Seen</th>
                <th className="px-4 py-3 font-normal">Tier</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {rows.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.name ?? "—"}</div>
                    <div className="text-slate">{u.email}</div>
                    <div className="font-mono text-[11px] text-slate">since {formatDate(u.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">{u.activeKeys}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{formatNumber(usage.get(u.id) ?? 0)}</td>
                  <td className="px-4 py-3 text-slate">{timeAgo(u.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    <form action={setTierAction} className="flex gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="tier"
                        defaultValue={u.tier}
                        aria-label="Tier"
                        className="rounded-lg bg-primary px-2.5 py-1.5 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset"
                      >
                        {Object.entries(tiers).map(([id, t]) => (
                          <option key={id} value={id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" color="secondary" size="xs">
                        Save
                      </Button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {u.id === viewer.user.id ? (
                      <span className="text-slate">You</span>
                    ) : (
                      <form action={setBannedAction} className="flex flex-col gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="banned" value={u.bannedAt ? "false" : "true"} />
                        {u.bannedAt ? (
                          <>
                            <Badge type="pill-color" color="error" size="sm">
                              Suspended{u.banReason ? `: ${u.banReason}` : ""}
                            </Badge>
                            <Button type="submit" color="secondary" size="xs" className="self-start">
                              Reinstate
                            </Button>
                          </>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              name="reason"
                              placeholder="Reason"
                              maxLength={200}
                              aria-label="Reason"
                              className="w-36 rounded-lg bg-primary px-2.5 py-1.5 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset placeholder:text-placeholder"
                            />
                            <Button type="submit" color="secondary-destructive" size="xs">
                              Suspend
                            </Button>
                          </div>
                        )}
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Band>
  );
}
