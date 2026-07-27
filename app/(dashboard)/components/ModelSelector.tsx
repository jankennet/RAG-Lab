import type { ProviderConfig, LlmProvider } from "@/lib/types";

type ModelSelectorProps = {
  provider: LlmProvider;
  model: string;
  providers: ProviderConfig[];
  onChange: (provider: LlmProvider, model: string) => void;
};

export function ModelSelector({ provider, model, providers, onChange }: ModelSelectorProps) {
  const activeProvider = providers.find((item) => item.value === provider) ?? providers[0];

  return (
    <div className="model-selector">
      <div className="section-head">
        <h2>Provider</h2>
        <span>Model routing</span>
      </div>

      <div className="provider-row">
        {providers.map((item) => (
          <button key={item.value} type="button" className={`provider-chip${item.value === provider ? " active" : ""}`} onClick={() => onChange(item.value, item.defaultModel)}>
            <span>{item.icon}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>

      <label className="field-block">
        <span className="field-label">Model</span>
        <select className="field-input" value={model} onChange={(event) => onChange(provider, event.target.value)}>
          {activeProvider.models.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
