import { useUserStore } from "@/stores/useUserStore";

export function useSubscription() {
  const { profile } = useUserStore();
  const isActive = profile?.subscription_status === "active";
  return { isActive };
}
