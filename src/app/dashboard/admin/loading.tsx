import { HeaderSkeleton, StatsSkeleton, TableSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-7" role="status" aria-label="Loading">
      <HeaderSkeleton />
      <StatsSkeleton />
      <TableSkeleton />
    </div>
  );
}
