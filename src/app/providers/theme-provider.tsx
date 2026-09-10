import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark';

type ThemeContextValue = { theme: ThemeChoice; setTheme: (theme: ThemeChoice) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const key = 'feliam-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(key);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem(key, theme);
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
