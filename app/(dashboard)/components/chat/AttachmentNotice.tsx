interface AttachmentNoticeProps {
  notice: string | null;
  onDismiss: () => void;
}

export function AttachmentNotice({ notice, onDismiss }: AttachmentNoticeProps) {
  if (!notice) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">
      <span className="flex-1">{notice}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-accent/70 hover:text-accent transition-colors leading-none"
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}