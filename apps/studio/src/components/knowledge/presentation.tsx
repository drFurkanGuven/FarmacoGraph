"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MonitorPlay, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

const STORAGE_KEY = "farmacograph.studio.presentation";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface PresentationContextValue {
  /** True hides curator-technical panels (JSON dumps, raw IDs, draft internals). */
  presentation: boolean;
  setPresentation: (value: boolean) => void;
}

const PresentationContext = createContext<PresentationContextValue>({
  presentation: false,
  setPresentation: () => {},
});

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const [presentation, setPresentationState] = useState<boolean>(() => readStored());

  const setPresentation = useCallback((value: boolean) => {
    setPresentationState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Private mode — presentation simply resets on reload.
    }
  }, []);

  const value = useMemo(() => ({ presentation, setPresentation }), [presentation, setPresentation]);

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation(): PresentationContextValue {
  return useContext(PresentationContext);
}

/** Reader/curator view switch — knowledge pages only, persisted per browser. */
export function PresentationToggle({ className }: { className?: string }) {
  const { presentation, setPresentation } = usePresentation();
  const { t } = useLanguage();
  return (
    <Button
      type="button"
      size="sm"
      variant={presentation ? "default" : "outline"}
      className={className}
      onClick={() => setPresentation(!presentation)}
      title={t("presentation.hint", "Hide technical panels for readers")}
    >
      {presentation ? <PencilLine className="h-4 w-4" /> : <MonitorPlay className="h-4 w-4" />}
      {presentation
        ? t("presentation.curatorView", "Curator view")
        : t("presentation.presentationView", "Presentation")}
    </Button>
  );
}
