import { Skeleton } from "@/components/admin/kit";
import { TableSkeleton } from "@/components/admin/skeletons";

/** Opening an API: header and tabs placeholders, then the tab body. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-7" role="status" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <div className="flex gap-6 border-b border-neutral-200 pb-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}
