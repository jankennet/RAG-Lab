import type { ReactNode } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import DashboardProvider from "./components/DashboardProvider";

export const metadata = {
  title: "Agentic RAG",
  description: "Free RAG Platform with NVIDIA NIM",
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-bg text-text antialiased">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-bg/80 backdrop-blur-sm border-r border-line flex flex-col p-4">
            <Sidebar />
          </aside>
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}