// Applique la couleur d'accent du profil sur les variables CSS dorées (--color-gold*),
// de sorte que toute l'interface se recolore en direct depuis les Réglages.

export const DEFAULT_ACCENT = "#c5a572";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(channel: number, target: number, amount: number): number {
  return clampByte(channel + (target - channel) * amount);
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => clampByte(x).toString(16).padStart(2, "0")).join("");
}

function normalize(hex?: string | null): string {
  if (!hex) return DEFAULT_ACCENT;
  const candidate = hex.startsWith("#") ? hex : `#${hex}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate) ? candidate : DEFAULT_ACCENT;
}

export function applyAccent(hex?: string | null): void {
  if (typeof document === "undefined") return;
  const accent = normalize(hex);
  const { r, g, b } = hexToRgb(accent);
  const root = document.documentElement;
  root.style.setProperty("--color-gold", accent);
  root.style.setProperty("--color-gold-light", toHex(mix(r, 255, 0.25), mix(g, 255, 0.25), mix(b, 255, 0.25)));
  root.style.setProperty("--color-gold-muted", toHex(mix(r, 0, 0.3), mix(g, 0, 0.3), mix(b, 0, 0.3)));
  root.style.setProperty("--color-gold-border", `rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty("--color-gold-glow", `rgba(${r}, ${g}, ${b}, 0.08)`);
}
