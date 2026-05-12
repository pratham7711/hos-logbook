import { create } from "zustand";

type Theme = "day" | "night";

interface UiState {
  theme: Theme;
  officerView: boolean;
  selectedDate: string | null;
  focusedStopSeq: number | null;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setOfficerView: (v: boolean) => void;
  toggleOfficerView: () => void;
  setSelectedDate: (d: string | null) => void;
  setFocusedStop: (seq: number | null) => void;
}

const initial: Theme = (() => {
  try {
    const stored = localStorage.getItem("hos-theme");
    if (stored === "day" || stored === "night") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  } catch {
    return "day";
  }
})();

if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", initial === "night");
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: initial,
  officerView: false,
  selectedDate: null,
  focusedStopSeq: null,
  setTheme: (t) => {
    set({ theme: t });
    document.documentElement.classList.toggle("dark", t === "night");
    try {
      localStorage.setItem("hos-theme", t);
    } catch {}
  },
  toggleTheme: () => get().setTheme(get().theme === "day" ? "night" : "day"),
  setOfficerView: (v) => {
    set({ officerView: v });
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("officer-view", v);
    }
  },
  toggleOfficerView: () => get().setOfficerView(!get().officerView),
  setSelectedDate: (d) => set({ selectedDate: d }),
  setFocusedStop: (seq) => set({ focusedStopSeq: seq }),
}));
