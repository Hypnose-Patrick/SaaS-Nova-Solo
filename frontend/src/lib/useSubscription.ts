import { useUserStore } from "@/stores/useUserStore";

export function useSubscription() {
  const { profile } = useUserStore();
  const isActive = profile?.subscription_status === "active" || profile?.subscription_status === "trialing" || !!profile?.is_admin;
  return { isActive };
}
