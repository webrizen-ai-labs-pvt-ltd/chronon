import { notFound } from "next/navigation";
import { monthlyUsage, searchUsers } from "@/lib/accounts";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { tiers } from "@/lib/limits";
import { requireViewer } from "@/lib/viewer";
import { setBannedAction, setTierAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireViewer("/dashboard/admin");
  if (!viewer.isAdmin) notFound();

  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await searchUsers(q);
  const usage = await monthlyUsage(rows.map((r) => r.id));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-12 sm:px-[22px] md:py-16">
      <div className="flex flex-col gap-3">
        <p className="label text-slate">Admin</p>
        <h1 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">Accounts</h1>
        <p className="text-[17px] text-ink-2">Change tiers or suspend accounts. Changes reach the API within a minute.</p>
      </div>

      <form className="flex gap-3" role="search">
        <label htmlFor="q" className="sr-only">
          Search by email or name
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by email or name" className="input max-w-[360px]" />
        <button className="btn btn-outline">Search</button>
      </form>

      <div className="overflow-x-auto rounded-md border border-line-light bg-card">
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
                    <select name="tier" defaultValue={u.tier} className="input w-auto py-1 text-[14px]" aria-label="Tier">
                      {Object.entries(tiers).map(([id, t]) => (
                        <option key={id} value={id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-outline px-3 py-1 text-[13px]">Save</button>
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
                          <span className="text-[14px] text-[#b4432b]">Suspended{u.banReason ? `: ${u.banReason}` : ""}</span>
                          <button className="btn btn-outline self-start px-3 py-1 text-[13px]">Reinstate</button>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <input name="reason" placeholder="Reason" className="input w-36 py-1 text-[14px]" maxLength={200} aria-label="Reason" />
                          <button className="btn btn-outline px-3 py-1 text-[13px]">Suspend</button>
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
  );
}
