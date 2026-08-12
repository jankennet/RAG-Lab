// Hover-revealed delete affordance for a dataset card in the list. Lifted from
// datasets/page.tsx L594-602: the absolute-positioned, opacity-0→group-hover
// "Delete" text button. confirm() stays in the page's handler (the original
// surfaced `confirm("Delete this dataset?")` before calling deleteDataset) so
// the caller decides whether to prompt — keeps this leaf free of IO.

type DeleteDatasetButtonProps = {
  onDelete: () => void;
};

export default function DeleteDatasetButton({ onDelete }: DeleteDatasetButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onDelete();
      }}
      className="absolute top-3 right-3 text-xs text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
    >
      Delete
    </button>
  );
}
