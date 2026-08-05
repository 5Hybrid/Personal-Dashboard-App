import { Check } from "lucide-react";
import { CLASS_COLOR_KEYS, CLASS_COLOR_SWATCH_CLASS, type ClassColorKey } from "@/lib/classColors";
import { cn } from "@/lib/utils";

// Used by the class create/edit forms to pick the pastel theme stored in
// Context.color (a palette key, not a raw hex — see classColors.ts).
export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: ClassColorKey | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        title="No color"
        onClick={() => onChange(null)}
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground",
          !value && "ring-2 ring-primary ring-offset-1",
        )}
      >
        <span className="text-[10px]">×</span>
      </button>
      {CLASS_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            CLASS_COLOR_SWATCH_CLASS[key],
            value === key && "ring-2 ring-primary ring-offset-1",
          )}
        >
          {value === key && <Check className="size-3.5 text-black/60" />}
        </button>
      ))}
    </div>
  );
}
