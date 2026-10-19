import type { JSX } from "react";
import type { ThemePreference } from "@/models/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

interface ThemeSwitchProps {
  preference: ThemePreference;
  onChange: (next: ThemePreference) => void;
}

export function ThemeSwitch({ preference, onChange }: ThemeSwitchProps): JSX.Element {
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-switch__option"
          aria-pressed={preference === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
