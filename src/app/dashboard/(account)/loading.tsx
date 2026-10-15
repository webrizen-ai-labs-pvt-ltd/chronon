import { Skeleton } from "@/components/admin/kit";

export default function Loading() {
  return (
    <div className="container flex flex-col gap-6 py-14" role="status" aria-label="Loading">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-40 w-full rounded-xl" />
    </div>
  );
}
