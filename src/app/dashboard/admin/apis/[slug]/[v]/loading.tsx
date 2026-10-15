import { TableSkeleton } from "@/components/admin/skeletons";

/** Switching tabs: the API header and tabs stay; only the body shows a placeholder. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <TableSkeleton rows={6} />
    </div>
  );
}
