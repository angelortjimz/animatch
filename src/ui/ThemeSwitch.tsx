import type { JSX } from "react";
import type { Theme } from "@/models/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

interface ThemeSwitchProps {
  theme: Theme;
  onChange: (next: Theme) => void;
}

export function ThemeSwitch({ theme, onChange }: ThemeSwitchProps): JSX.Element {
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-switch__option"
          aria-pressed={theme === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
