// Shared page shell: the scrolling wrapper + centered max-width column that
// every dashboard page opens with:
//   <div className="h-full overflow-y-auto"><div className="max-w-{N}xl mx-auto px-6 py-8">
// Previously copy-pasted ~7 times with only the max-width (and an occasional
// space-y) varying. Takes the width as a prop so it can't drift.

import type { ReactNode } from "react";

// Literal class strings so Tailwind v4's static scanner keeps them. Dynamic
// `max-w-${n}xl` interpolation would be purged from the compiled CSS.
const MAX_WIDTH_CLASS: Record<2 | 3 | 5 | 6, string> = {
  2: "max-w-2xl",
  3: "max-w-3xl",
  5: "max-w-5xl",
  6: "max-w-6xl",
};

type PageShellProps = {
  children: ReactNode;
  maxWidth?: 2 | 3 | 5 | 6;
  /** Extra classes for the inner column (e.g. "space-y-8"). */
  bodyClassName?: string;
};

export default function PageShell({ children, maxWidth = 3, bodyClassName }: PageShellProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={`${MAX_WIDTH_CLASS[maxWidth]} mx-auto px-6 py-8 ${bodyClassName ?? ""}`}>
        {children}
      </div>
    </div>
  );
}
