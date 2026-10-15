import { cardCls, Skeleton } from "./kit";
import { cx } from "@/utils/cx";

export function HeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-[60vw]" />
      </div>
      {actions && <Skeleton className="h-10 w-28 rounded-lg" />}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cx(cardCls, className)}>
      <div className="flex gap-6 border-b border-neutral-200 bg-paper/50 px-5 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-neutral-200/50 px-5 py-4 last:border-0">
          <div className="flex w-1/3 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {Array.from({ length: cols - 1 }, (_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={cx(cardCls, "flex flex-col gap-3 p-5")}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
