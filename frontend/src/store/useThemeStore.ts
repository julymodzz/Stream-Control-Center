import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  resolve: () => void;
}

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      resolved: 'dark',
      setTheme: (theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        document.documentElement.classList.toggle('light', resolved === 'light');
        set({ theme, resolved });
      },
      resolve: () => {
        const { theme } = get();
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        document.documentElement.classList.toggle('light', resolved === 'light');
        set({ resolved });
      },
    }),
    { name: 'scc-theme' }
  )
);
