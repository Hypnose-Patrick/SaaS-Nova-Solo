import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/useUserStore";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const reset = useUserStore((s) => s.reset);
  const chatReset = useChatStore((s) => s.clearLocal);
  const setOpen = useChatStore((s) => s.setOpen);

  async function handleSignOut() {
    await supabase.auth.signOut();
    reset();
    chatReset();
  }

  return (
    <header
      style={{
        height: 56,
        borderBottom: "var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        background: "var(--color-bg-primary)",
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-lg)",
          fontWeight: 400,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <Button
          size="sm"
          variant="gold"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir Nova"
        >
          Nova
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSignOut}>
          Quitter
        </Button>
      </div>
    </header>
  );
}
