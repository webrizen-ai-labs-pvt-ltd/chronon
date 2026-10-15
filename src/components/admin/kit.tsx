import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Presentational pieces for the admin console. Server-safe (no hooks), so
 * pages can render them directly.
 */

export const inputCls =
  "w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset outline-none transition placeholder:text-placeholder focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-error";
export const selectCls = cx(inputCls, "admin-select appearance-none pr-9");
export const monoCls = "font-mono text-[12.5px]";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <div className="text-[13px] text-slate">{eyebrow}</div>}
        <h1 className="text-[26px] leading-[1.1] font-bold tracking-[-0.025em] text-night sm:text-[28px]">{title}</h1>
        {description && <p className="max-w-[720px] text-[14.5px] leading-relaxed text-slate">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const cardCls = "min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-card shadow-[0_1px_2px_rgba(15,18,32,0.04)]";

export function Card({ title, description, actions, children, className, bodyClassName }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx(cardCls, className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h2 className="text-[15px] font-bold tracking-[-0.01em] text-night">{title}</h2>}
            {description && <p className="text-[13px] text-slate">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, trend, icon }: { label: string; value: ReactNode; hint?: ReactNode; trend?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cx(cardCls, "flex min-w-0 flex-col gap-3 p-4 sm:p-5")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] text-slate sm:text-[13.5px]">{label}</p>
        {icon && <span className="grid size-7 shrink-0 place-items-center rounded-md bg-paper text-slate ring-1 ring-neutral-200 *:size-4">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[24px] leading-none font-bold tracking-[-0.03em] text-night tabular-nums sm:text-[28px]">{value}</p>
        <span className="max-sm:hidden">{trend}</span>
      </div>
      {hint && <p className="truncate text-[12.5px] text-slate">{hint}</p>}
    </div>
  );
}

/** Placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-neutral-200/70", className)} aria-hidden />;
}

const stateStyles: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  published: "bg-[#e9f7ef] text-[#17663a] ring-[#bfe5cd]",
  deprecated: "bg-[#fff6e5] text-[#8a5a00] ring-[#f5dca8]",
  retired: "bg-neutral-100 text-neutral-500 ring-neutral-200 line-through decoration-neutral-400",
  active: "bg-[#e9f7ef] text-[#17663a] ring-[#bfe5cd]",
  disabled: "bg-[#fdecec] text-[#a12b2b] ring-[#f3c4c4]",
  builtin: "bg-[#efecfb] text-[#4a36ae] ring-[#d8d0f6]",
};
const stateDots: Record<string, string> = {
  draft: "bg-neutral-400",
  published: "bg-[#22a05a]",
  deprecated: "bg-[#e0a100]",
  retired: "bg-neutral-400",
  active: "bg-[#22a05a]",
  disabled: "bg-[#d64545]",
  builtin: "bg-ion",
};

/** Lifecycle pill: draft · published · deprecated · retired · active · disabled · builtin. */
export function StatePill({ state, label, className }: { state: string; label?: string; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ring-1 ring-inset",
        !label && "capitalize",
        stateStyles[state] ?? stateStyles.draft,
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full", stateDots[state] ?? stateDots.draft)} aria-hidden />
      {label ?? state}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11.5px] text-neutral-700 ring-1 ring-neutral-200 ring-inset", className)}>{children}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <div className="grid size-11 place-items-center rounded-xl border border-neutral-200 bg-paper text-slate *:size-5">{icon}</div>}
      <div className="flex max-w-[420px] flex-col gap-1">
        <p className="text-[16px] font-bold text-night">{title}</p>
        {description && <p className="text-[14px] text-slate">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ children, className, minWidth = 720 }: { children: ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full text-left text-[14px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const thCls = "border-b border-neutral-200 bg-paper/50 px-4 py-2.5 font-mono text-[10.5px] font-normal tracking-[0.05em] text-slate uppercase whitespace-nowrap first:pl-5 last:pr-5";
export const tdCls = "border-b border-neutral-200 px-4 py-3 align-middle first:pl-5 last:pr-5 [tr:last-child_&]:border-b-0";

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title?: ReactNode; children?: ReactNode }) {
  const tones = {
    info: "border-[#d8d0f6] bg-[#f6f3fe] text-[#3b2c8f]",
    warning: "border-[#f5dca8] bg-[#fffaf0] text-[#7a4f00]",
    error: "border-[#f3c4c4] bg-[#fef5f5] text-[#8f2424]",
    success: "border-[#bfe5cd] bg-[#f2fbf5] text-[#17663a]",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-[14px] leading-relaxed", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5 opacity-90" : undefined}>{children}</div>}
    </div>
  );
}

/** Tiny bar chart for daily request counts. */
export function Sparkbars({ values, height = 28, className }: { values: number[]; height?: number; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 6;
  const gap = 3;
  return (
    <svg width={values.length * (w + gap) - gap} height={height} className={cx("shrink-0", className)} aria-hidden>
      {values.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * height));
        return <rect key={i} x={i * (w + gap)} y={height - h} width={w} height={h} rx={1.5} className={v ? "fill-ion" : "fill-neutral-200"} />;
      })}
    </svg>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2.5 text-[14px]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-slate">{k}</dt>
          <dd className="min-w-0 text-night">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
