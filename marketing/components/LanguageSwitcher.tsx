import { useMemo } from 'preact/hooks';

interface LocaleOption {
  locale: string;
  label: string;
  path: string;
}

interface LanguageSwitcherProps {
  currentLocale: string;
  options: LocaleOption[];
}

export default function LanguageSwitcher({ currentLocale, options }: LanguageSwitcherProps) {
  const sortedOptions = useMemo(
    () => options.slice().sort((a, b) => a.label.localeCompare(b.label)),
    [options],
  );

  return (
    <select
      className="locale-select"
      aria-label="Language"
      value={currentLocale}
      onChange={(event) => {
        const nextLocale = event.currentTarget.value;
        const nextOption = sortedOptions.find((option) => option.locale === nextLocale);
        if (!nextOption) return;
        try {
          window.localStorage.setItem('tf_app_language', nextLocale);
        } catch {
          // Language navigation still works without localStorage.
        }
        window.location.assign(nextOption.path);
      }}
    >
      {sortedOptions.map((option) => (
        <option key={option.locale} value={option.locale}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
