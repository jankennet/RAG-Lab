import type { ReactNode } from "react";
import Sidebar from "./components/Sidebar";
import DashboardProvider from "./components/DashboardProvider";

export const metadata = {
  title: "Agentic RAG",
  description: "Free RAG Platform with NVIDIA NIM",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <div className="flex h-screen bg-bg text-text antialiased overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-line p-4">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </DashboardProvider>
  );
}