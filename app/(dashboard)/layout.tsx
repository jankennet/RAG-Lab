import type { ReactNode } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-frame">
        <Header />
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
