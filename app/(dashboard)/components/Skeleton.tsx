// Tiny skeleton primitives + a couple of page-shaped placeholders.
// Use these anywhere a loader is displayed so the UI keeps its silhouette
// and never looks like it's crashed.

import React from 'react';

const PULSE = "animate-pulse bg-line/60 rounded-md";

export function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${PULSE} ${className ?? ""}`} style={style} aria-hidden {...props} />;
}

export function SkeletonBar({ width = "100%", height = "h-3" }: { width?: string; height?: string }) {
  return <Skeleton className={`${height} w-[var(--sk-w)]`} style={{ "--sk-w": width } as React.CSSProperties} />;
}

export function SkeletonCircle({ size = "h-9 w-9" }: { size?: string }) {
  return <Skeleton className={`${size} rounded-full`} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-bg-alt/60 border border-line rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${100 - i * 12}%` }} />
        ))}
     </div>
   </div>
  );
}

export function SkeletonPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-bg-alt rounded-2xl border border-line p-6 space-y-4">
      <Skeleton className="h-5 w-1/4" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-3" 
            style={{ width: `${100 - (i % 3) * 18}%` }} 
          />
        ))}
      </div>
    </div>
  );
}

/** Sidebar-sized chat list placeholder. */
export function ChatSidebarSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1 max-h-52 overflow-hidden pr-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl px-3 py-2 border border-transparent bg-panel/40">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2 w-1/2 mt-2" />
       </div>
      ))}
   </div>
  );
}

/** Header + form placeholders for list/edit pages (datasets, benchmarks, etc). */
export function PageListSkeleton({ itemCount = 4 }: { itemCount?: number }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <Skeleton className="h-7 w-32" />
        <div className="bg-bg-alt rounded-2xl border border-line p-6 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
       </div>
        <div className="space-y-3">
          {Array.from({ length: itemCount }).map((_, i) => (
            <SkeletonCard key={i} rows={3} />
          ))}
       </div>
     </div>
   </div>
  );
}

/** Detail-page skeleton (title + cards). */
export function PageDetailSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-24" />
       </div>
        <SkeletonCard rows={4} />
        <SkeletonCard rows={2} />
     </div>
   </div>
  );
}

/** Settings-page skeleton. */
export function PageSettingsSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <Skeleton className="h-7 w-40" />
        <SkeletonPanel rows={3} />
        <SkeletonPanel rows={5} />
     </div>
   </div>
  );
}

/** Compare / benchmarks skeleton. */
export function PageTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-7 w-44" />
        <div className="bg-bg-alt border border-line rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-3/4" />
            ))}
         </div>
          <div className="divide-y divide-line/40">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-3" style={{ width: `${70 + ((i + j) % 4) * 7}%` }} />
                ))}
             </div>
            ))}
         </div>
       </div>
     </div>
   </div>
  );
}

/** Chat conversation placeholder — header + message bubbles. */
export function ChatConversationSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-5 w-10" />
       </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-24 rounded-xl" />
       </div>
     </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          <div className="space-y-2">
            <SkeletonCircle size="h-8 w-8" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
         </div>
          <div className="space-y-2 flex flex-col items-end">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
         </div>
       </div>
     </div>
      <div className="flex-shrink-0 border-t border-line px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24 rounded-2xl" />
            <Skeleton className="h-9 w-40 rounded-2xl" />
         </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
       </div>
     </div>
   </div>
  );
}
