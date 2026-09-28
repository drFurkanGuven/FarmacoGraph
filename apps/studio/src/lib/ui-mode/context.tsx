"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UIMode = "professional" | "simple";

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimple: boolean;
}

const UIModeContext = createContext<UIModeContextValue | undefined>(undefined);

const STORAGE_KEY = "farmacograph-ui-mode";

export function UIModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("professional");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "simple" || stored === "professional") {
      setModeState(stored);
    }
    setMounted(true);
  }, []);

  const setMode = (newMode: UIMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const toggleMode = () => {
    setMode(mode === "professional" ? "simple" : "professional");
  };

  return (
    <UIModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isSimple: mounted && mode === "simple",
      }}
    >
      {children}
    </UIModeContext.Provider>
  );
}

export function useUIMode() {
  const context = useContext(UIModeContext);
  if (!context) {
    throw new Error("useUIMode must be used within UIModeProvider");
  }
  return context;
}
