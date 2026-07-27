"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Chat", note: "Ask data" },
  { href: "/datasets", label: "Datasets", note: "Upload or URL" },
  { href: "/settings", label: "Settings", note: "Keys and models" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="brand-mark">M</div>
        <div>
          <strong>Multi-Source RAG</strong>
          <span>Chat + datasets + keys</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

          return (
            <Link key={link.href} href={link.href} className={`sidebar-link${active ? " active" : ""}`}>
              <div>
                <span>{link.label}</span>
                <small>{link.note}</small>
              </div>
              <span className="link-arrow">↗</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-card">
        <span>Pipeline</span>
        <strong>Ingest, embed, retrieve, chat</strong>
        <p>Keep layout clean. Add backend after UI is sharp.</p>
      </div>
    </aside>
  );
}
