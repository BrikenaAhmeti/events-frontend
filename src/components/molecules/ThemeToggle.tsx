import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeChoice } from '../../app/providers/theme-provider';

const options: Array<{ value: ThemeChoice; icon: typeof Sun }> = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('common');
  return (
    <div
      className="inline-flex rounded-lg border border-border bg-surface p-1"
      role="group"
      aria-label={t('colorTheme')}
    >
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`grid size-11 place-items-center rounded-md transition-colors ${theme === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          aria-label={t(value)}
          aria-pressed={theme === value}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
