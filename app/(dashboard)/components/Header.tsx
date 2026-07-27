"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Chat", subtitle: "Grounded assistant for user datasets and docs." },
  "/datasets": { title: "Datasets", subtitle: "Upload files, test URLs, and inspect imports." },
  "/settings": { title: "Settings", subtitle: "Store provider keys, pick model, wire Supabase." }
};

export function Header() {
  const pathname = usePathname();
  const current = pathname.startsWith("/datasets")
    ? titles["/datasets"]
    : pathname.startsWith("/settings")
      ? titles["/settings"]
      : titles["/"];

  return (
    <header className="topbar">
      <div>
        <p className="topbar-kicker">Multi-Source Agentic RAG Platform</p>
        <h1>{current.title}</h1>
        <p>{current.subtitle}</p>
      </div>

      <div className="topbar-actions">
        <button className="ghost-button" type="button">Preview</button>
        <button className="primary-button" type="button">Deploy</button>
      </div>
    </header>
  );
}
