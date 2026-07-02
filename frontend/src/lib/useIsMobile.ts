import { useEffect, useState } from "react";

// Vrai sous le breakpoint (défaut 768px). SSR-safe, se met à jour au resize /
// rotation. Sert à basculer entre le shell desktop et le shell mobile.
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 0.02}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
