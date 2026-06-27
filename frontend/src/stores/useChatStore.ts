import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { askAgent } from "@/lib/ai";
import type { ChatMessage, AgentKey } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  activeAgent: AgentKey;
  thinking: boolean;
  open: boolean;
  setAgent: (agent: AgentKey) => void;
  setOpen: (open: boolean) => void;
  fetchHistory: (profileId: string) => Promise<void>;
  send: (text: string, profileId: string, context?: unknown) => Promise<void>;
  clearLocal: () => void;
}

function makeId(): string {
  return crypto.randomUUID();
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeAgent: "nova",
  thinking: false,
  open: false,

  setAgent: (agent) => set({ activeAgent: agent }),
  setOpen: (open) => set({ open }),

  fetchHistory: async (profileId) => {
    const { data } = await supabase
      .from("chat_history")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .limit(100);
    set({ messages: (data ?? []) as ChatMessage[] });
  },

  send: async (text, profileId, context) => {
    const { activeAgent, messages } = get();
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
      agent: activeAgent,
      created_at: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], thinking: true }));

    // Persister en base
    await supabase
      .from("chat_history")
      .insert({ profile_id: profileId, role: "user", content: text, agent: activeAgent });

    try {
      const history = messages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const content = await askAgent(activeAgent, text, context, history);

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content,
        agent: activeAgent,
        created_at: new Date().toISOString(),
      };

      await supabase.from("chat_history").insert({
        profile_id: profileId,
        role: "assistant",
        content,
        agent: activeAgent,
      });

      set((s) => ({ messages: [...s.messages, assistantMsg], thinking: false }));
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: err instanceof Error ? `⚠️ ${err.message}` : "Erreur inconnue",
        agent: activeAgent,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errorMsg], thinking: false }));
    }
  },

  clearLocal: () => set({ messages: [] }),
}));
