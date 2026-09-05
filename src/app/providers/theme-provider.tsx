import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

type ThemeContextValue = { theme: ThemeChoice; setTheme: (theme: ThemeChoice) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const key = 'feliam-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(key);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    localStorage.setItem(key, theme);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return (
    <ThemeContext.Provider value={useMemo(() => ({ theme, setTheme }), [theme])}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProviderMissing');
  return context;
}
