import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface Step {
  step: number;
  text: string;
}

interface HelpModalProps {
  title: string;
  description: string;
  steps: Step[];
  tips?: string[];
}

export function HelpButton(props: HelpModalProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {open && <HelpModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function HelpModal({ title, description, steps, tips, onClose }: HelpModalProps & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-black text-lg">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">{description}</p>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center mt-0.5">
                  {step}
                </span>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Tips */}
          {tips && tips.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Tips</p>
              {tips.map((tip, i) => (
                <p key={i} className="text-xs text-amber-800 leading-relaxed">• {tip}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
