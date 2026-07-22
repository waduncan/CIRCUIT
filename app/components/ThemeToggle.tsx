import { Switch } from "./ui/Switch";
import { useTheme } from "../hooks/useTheme";

// Topbar light/dark toggle (issue #49). Encapsulates the theme hook so the shell only mounts one
// element. Uses the shared Switch; the choice is persisted to localStorage by useTheme.
export function ThemeToggle() {
  const { isDark, setTheme } = useTheme();
  return (
    <label className="theme-toggle" title="Toggle dark mode">
      <span aria-hidden>☀</span>
      <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label="Toggle dark mode" />
      <span aria-hidden>☾</span>
    </label>
  );
}
