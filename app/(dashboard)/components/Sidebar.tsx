"use client";

import Link from "next/link";
import { useDashboard } from "./DashboardProvider";
import { PROVIDERS } from "@/lib/types";

export default function Sidebar() {
  const { preferences } = useDashboard();

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">AR</span>
        </div>
        <h1 className="text-xl font-bold text-text">Agentic RAG</h1>
      </div>

      <nav className="mt-6 space-y-2">
        <Link
          href="/"
          className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-bg/80 text-muted transition-colors"
        >
          <span>+ New Chat</span>
        </Link>
      </nav>

      <div className="mt-6">
        <h2 className="font-semibold text-muted mb-2">Knowledge</h2>
        <div className="space-y-1">
          <Link
            href="/datasets"
            className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-bg/80 text-muted transition-colors"
          >
            <span>Datasets</span>
          </Link>
          <Link
            href="/benchmarks"
            className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-bg/80 text-muted transition-colors"
          >
            <span>Benchmarks</span>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-muted mb-2">Settings</h2>
        <div className="space-y-1">
          <Link
            href="/settings"
            className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-bg/80 text-muted transition-colors"
          >
            <span>Models & Keys</span>
          </Link>
        </div>
      </div>

      <div className="mt-auto border-t border-line pt-4">
        <div className="flex items-center space-x-3 text-xs text-muted">
          <a href="https://github.com" className="hover:text-text transition-colors" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}