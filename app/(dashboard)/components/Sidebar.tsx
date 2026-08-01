"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "Knowledge",
    items: [
      { href: "/datasets", label: "Datasets" },
      { href: "/benchmarks", label: "Benchmarks" },
      { href: "/ranking", label: "Ranking" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "Models & Keys" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8 group">
        <div className="h-9 w-9 bg-accent rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
          <span className="text-[#03111a] text-sm font-bold">AR</span>
        </div>
        <span className="text-lg font-bold text-text tracking-tight">Agentic RAG</span>
      </Link>

      {/* New Chat */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-3 py-2.5 mb-6 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/15 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 1v12M1 7h12" />
        </svg>
        New Chat
      </Link>

      {/* Nav groups */}
      <div className="flex-1 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h2 className="px-3 mb-1.5 text-xs font-semibold text-muted tracking-wider uppercase">
              {group.label}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-muted hover:text-text hover:bg-bg-alt/50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-line">
        <a
          href="https://github.com/jankennet/Multi-Source-Agentic-RAG-Platform.git"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted hover:text-text transition-colors rounded-lg"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.55.73.55 1.43 0 1.07-.03 1.93-.02 2.2.03.41.55.27.55-.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
      </div>
    </nav>
  );
}