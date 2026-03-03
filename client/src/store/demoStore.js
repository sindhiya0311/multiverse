import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useDemoStore = create(
  persist(
    (set) => ({
      demoMode: false,
      setDemoMode: (enabled) => set({ demoMode: enabled }),
      toggleDemoMode: () => set((s) => ({ demoMode: !s.demoMode })),
    }),
    { name: 'noctis-demo', partialize: (s) => ({ demoMode: s.demoMode }) }
  )
);
