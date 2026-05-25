import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useRealtimePresence(pageKey: string) {
  const { user, profile, currentOrganization } = useAuth();
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || !currentOrganization) return;

    const channelId = `presence-${currentOrganization.id}-${pageKey}`;
    const channel = supabase.channel(channelId);

    // 1. Presence synchronization listeners
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flatMap((presence: any) => presence);
        // Filter out current user from active peers list
        setActiveUsers(users.filter(u => u.user_id !== user.id));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userName, fieldId, isTyping } = payload;
        setTypingUsers(prev => {
          const next = { ...prev };
          if (isTyping) {
            next[fieldId] = userName;
          } else {
            delete next[fieldId];
          }
          return next;
        });
      });

    // 2. Track presence state
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          full_name: profile?.full_name || user.email || "Workspace User",
          active_page: pageKey,
          online_at: new Date().toISOString()
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user, currentOrganization, pageKey]);

  // Broadcast event for typing states
  const sendTypingStatus = (fieldId: string, isTyping: boolean) => {
    if (!currentOrganization || !user) return;
    const channelId = `presence-${currentOrganization.id}-${pageKey}`;
    
    supabase.channel(channelId).send({
      type: "broadcast",
      event: "typing",
      payload: {
        userName: profile?.full_name || user.email || "Workspace User",
        fieldId,
        isTyping
      }
    });
  };

  return { activeUsers, typingUsers, sendTypingStatus };
}
