import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-line bg-bg/50 backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">AR</span>
        </div>
        <h1 className="text-xl font-bold text-text">Agentic RAG</h1>
      </div>
      <div className="flex items-center space-x-4 text-sm text-muted">
        <Link href="/" className="hover:text-text transition-colors">
          New Chat
        </Link>
      </div>
    </header>
  );
}
