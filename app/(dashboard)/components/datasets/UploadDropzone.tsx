// Multi-file upload drop zone + selected-file list for the Add Dataset form.
// Owns the drag/drop visuals and the hidden file input; selection is forwarded
// to `useDatasetAddForm.addFiles`. Lifted verbatim from datasets/page.tsx
// L145-189 (handlers) + L469-547 (JSX). `dragOver` accent flash stays local so
// the leaf component owns its own pointer visuals. Uses the shared
// `ACCEPT_ATTR` constant so the accept list can't drift from the chat flow.

import { useRef, useState, type DragEvent } from "react";
import { ACCEPT_ATTR } from "@/app/(dashboard)/lib/datasets/fileExts";

type UploadDropzoneProps = {
  selectedFiles: File[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
};

export default function UploadDropzone({
  selectedFiles,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0);

  // ── Drop handlers ───────────────────────────────
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  // Border style follows the page's three-state rule:
  // dragging-accent / has-files-success / idle-line-hover.
  const borderClass = dragOver
    ? "border-accent bg-accent/5"
    : selectedFiles.length > 0
      ? "border-success/40 bg-success/5"
      : "border-line hover:border-accent/30";

  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-1.5">
        Files ({selectedFiles.length} selected)
      </label>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFilePick}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${borderClass}`}
      >
        {selectedFiles.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-text">
              {selectedFiles.length} file(s) — {(totalSize / 1024).toFixed(1)} KB total
            </p>
            <p className="text-xs text-accent mt-1">Drop more or click to add</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-text">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted mt-1">
              TXT, JSON, CSV, MD, HTML, SQL, PDF, DOCX, XLSX, images · Stored in OPFS (browser storage)
            </p>
          </div>
        )}
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {selectedFiles.map((f, i) => (
            <div
              key={f.name + f.lastModified}
              className="flex items-center justify-between bg-[#03111a] border border-line rounded-lg px-3 py-2 text-xs"
            >
              <span className="text-text truncate mr-3 flex-1 min-w-0">{f.name}</span>
              <span className="text-muted flex-shrink-0 mr-3">
                {(f.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                className="text-muted hover:text-danger transition-colors flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onClearFiles}
            className="text-xs text-muted hover:text-danger transition-colors mt-1 block"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
