import { getCatalog } from "@/apis/menus/catalog";
import { cn } from "@/lib/cn";
import { apiBase } from "@/lib/site";

/** Larger intro paragraph under a page title. */
export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-[22px] leading-[1.4] text-pretty text-ink-2">{children}</p>;
}

export function Callout({ title, tone = "note", children }: { title?: string; tone?: "note" | "warn"; children: React.ReactNode }) {
  return (
    <aside
      className={cn(
        "rounded-md border bg-card px-5 py-4 text-[17px] leading-normal [&>p+p]:mt-2",
        tone === "warn" ? "border-photon/50" : "border-line-light",
      )}
    >
      {title && <p className={cn("label mb-1", tone === "warn" ? "text-photon" : "text-ion")}>{title}</p>}
      {children}
    </aside>
  );
}

/** "GET /v1/…" heading line with the full URL underneath. */
export function Endpoint({ method = "GET", path }: { method?: string; path: string }) {
  return (
    <div className="code-dark flex flex-col gap-0.5 px-5 py-3">
      <div>
        <span className="text-photon">{method}</span> <span className="text-paper">/v1{path}</span>
      </div>
      <div className="text-[12px] break-all text-comment">
        {apiBase}
        {path}
      </div>
    </div>
  );
}

/** Live list of regions in the dataset. */
export function RegionList() {
  const { regions } = getCatalog();
  return (
    <table>
      <thead>
        <tr>
          <th>Slug</th>
          <th>Region</th>
          <th>Country</th>
          <th>Dishes</th>
        </tr>
      </thead>
      <tbody>
        {regions.map((r) => (
          <tr key={r.slug}>
            <td>
              <code>{r.slug}</code>
            </td>
            <td>{r.name}</td>
            <td className="font-mono text-[13px] text-slate">{r.country_code}</td>
            <td>{r.dish_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Param ={ name: string; type: string; description: React.ReactNode };

export function ParamTable({ params }: { params: Param[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.name}>
            <td>
              <code>{p.name}</code>
            </td>
            <td className="font-mono text-[13px] whitespace-nowrap text-slate">{p.type}</td>
            <td>{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
