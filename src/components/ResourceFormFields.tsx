import { Eye, EyeOff } from "lucide-react";

type ResourceFormValue = {
  name: string;
  type: "software" | "secure_note";
  url: string;
  tag: string;
  description: string;
  globalVisible: boolean;
};

type Props = {
  value: ResourceFormValue;
  onChange: (patch: Partial<ResourceFormValue>) => void;
};

const TYPE_OPTIONS = [
  { value: "software", label: "Software" },
  { value: "secure_note", label: "Secure Note" },
] as const;

export function ResourceFormFields({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Name</label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Type</label>
        <select
          value={value.type}
          onChange={(e) => onChange({ type: e.target.value as "software" | "secure_note" })}
          className="w-full rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">URL</label>
        <input
          type="text"
          value={value.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Tag</label>
        <input
          type="text"
          value={value.tag}
          onChange={(e) => onChange({ tag: e.target.value })}
          placeholder={value.type === "software" ? "Design, Dev, Finance..." : "Infra, Credentials..."}
          className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Description</label>
        <textarea
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="w-full resize-none rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
        />
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#4f566f]">Visibility</label>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange({ globalVisible: true })}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              value.globalVisible
                ? "border-[#232733] bg-[#f6f7fb]"
                : "border-[#e7eaf2] hover:border-[#cfd4e2]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-[#4f566f]" />
              <p className="text-[14px] font-semibold text-[#232733]">Visible for everyone in catalog</p>
            </div>
            <p className="mt-1 text-[12px] text-[#6c7285]">Users can find this resource and request access.</p>
          </button>
          <button
            type="button"
            onClick={() => onChange({ globalVisible: false })}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              !value.globalVisible
                ? "border-[#232733] bg-[#f6f7fb]"
                : "border-[#e7eaf2] hover:border-[#cfd4e2]"
            }`}
          >
            <div className="flex items-center gap-2">
              <EyeOff size={16} className="text-[#4f566f]" />
              <p className="text-[14px] font-semibold text-[#232733]">Confidential</p>
            </div>
            <p className="mt-1 text-[12px] text-[#6c7285]">Usually assigned per individual only.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
