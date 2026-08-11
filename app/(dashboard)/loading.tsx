// Route-level Suspense fallback for the dashboard shell.
// Shown instantly on navigation before the new page's chunk mounts,
// so the user sees the target page's silhouette immediately — not the
// previous page frozen. Specific folders override this with a tailored shape.
import { PageListSkeleton } from "@/app/(dashboard)/components/Skeleton";

export default function DashboardLoading() {
  return <PageListSkeleton />;
}
