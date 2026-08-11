// Shared error banner. Replaces the recurring
//   <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
//     <p className="text-danger text-sm">{error}</p>
//   </div>
// block inlined in benchmark-datasets (list+detail), compare, datasets (list+
// detail), benchmarks, and benchmarks/[id].

type ErrorBannerProps = {
  message: string | null;
  /** Optional margin class — pages varied between (none) and "mb-6". */
  className?: string;
};

export default function ErrorBanner({ message, className = "" }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div className={`bg-danger/10 border border-danger/20 rounded-xl p-4 ${className}`}>
      <p className="text-danger text-sm">{message}</p>
    </div>
  );
}
