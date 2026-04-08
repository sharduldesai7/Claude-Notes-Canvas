import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MousePointerClick, Sparkles, Map, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "synaptica_onboarded_v1";

export function useOnboarding() {
  const [open, setOpen] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return { open, dismiss };
}

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: string;
}

const STEPS: Step[] = [
  {
    icon: <Map className="w-8 h-8" />,
    title: "Welcome to Synaptica",
    description:
      "An infinite canvas for your thoughts. Create notes, organize ideas visually, and collaborate with Claude AI — all in one place.",
    hint: undefined,
  },
  {
    icon: <MousePointerClick className="w-8 h-8" />,
    title: "Create & Move Notes",
    description:
      "Double-click anywhere on the canvas to create a new note. Drag the top handle to move it, and pull the bottom-right corner to resize.",
    hint: "Tip: pick a note color from the palette icon on the drag handle.",
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: "Ask Claude AI",
    description:
      "Inside any note, type /claude followed by your question and press Enter. Claude reads your other notes for context and responds right inside the card.",
    hint: "Tip: you can ask Claude multiple questions — answers stack up like a chat thread.",
  },
  {
    icon: <Check className="w-8 h-8" />,
    title: "You're all set!",
    description:
      "Use the sidebar to create multiple maps and switch between them. Collapse the sidebar with the arrow button to get more canvas space.",
    hint: undefined,
  },
];

interface OnboardingModalProps {
  onDismiss: () => void;
}

export function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const goNext = () => {
    if (isLast) {
      onDismiss();
      return;
    }
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const variants = {
    enter: (d: number) => ({ x: d * 32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -32, opacity: 0 }),
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Skip button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
          aria-label="Skip onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step content */}
        <div className="px-8 pt-10 pb-6 min-h-[300px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="flex flex-col items-center text-center flex-1"
            >
              {/* Icon ring */}
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5">
                {current.icon}
              </div>

              <h2 className="text-xl font-display font-bold text-foreground mb-3">
                {current.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {current.description}
              </p>

              {current.hint && (
                <div className="mt-4 px-4 py-2.5 bg-primary/5 border border-primary/15 rounded-xl">
                  <p className="text-xs text-primary/80 leading-relaxed">{current.hint}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex flex-col gap-4">
          {/* Dot indicators */}
          <div className="flex justify-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={goBack} className="flex-1">
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={goNext}
              className={cn("flex items-center gap-1.5", step === 0 ? "w-full" : "flex-1")}
            >
              {isLast ? "Start Mapping" : "Next"}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Skip link */}
          {!isLast && (
            <button
              onClick={onDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Skip for now
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
