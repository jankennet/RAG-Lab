type ApiKeyCardProps = {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
};

export function ApiKeyCard({ label, description, value, onChange }: ApiKeyCardProps) {
  return (
    <label className="key-card">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <input
        className="field-input"
        type="password"
        value={value}
        placeholder="Paste key"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
