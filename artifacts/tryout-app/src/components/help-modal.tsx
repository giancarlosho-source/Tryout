import { useState } from "react";
import { HelpCircle, X, PlayCircle } from "lucide-react";
import type { HelpContent } from "@/lib/help-content";

export function HelpButton(props: HelpContent) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all"
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
        Help
      </button>
      {open && <HelpModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function HelpModal({ title, description, steps, tips, videoUrl, onClose }: HelpContent & { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-black text-lg">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <p className="text-sm text-muted-foreground">{description}</p>

          {/* Video embed */}
          {videoUrl && (
            <div className="rounded-xl overflow-hidden border bg-black aspect-video">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen"
                title={`${title} walkthrough`}
              />
            </div>
          )}

          {!videoUrl && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <PlayCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Video walkthrough coming soon.</span>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">How it works</p>
            {steps.map(({ step, text, image }) => (
              <div key={step}>
                <button
                  className="w-full flex gap-3 text-left hover:bg-muted/30 rounded-xl p-2 transition-colors"
                  onClick={() => setActiveStep(activeStep === step ? null : step)}
                >
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center mt-0.5">
                    {step}
                  </span>
                  <p className="text-sm leading-relaxed flex-1">{text}</p>
                </button>
                {image && activeStep === step && (
                  <div className="mt-2 ml-9 rounded-xl overflow-hidden border shadow-sm">
                    <img src={image} alt={`Step ${step}`} className="w-full object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tips */}
          {tips && tips.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Tips</p>
              {tips.map((tip, i) => (
                <p key={i} className="text-xs text-blue-800 leading-relaxed">• {tip}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
