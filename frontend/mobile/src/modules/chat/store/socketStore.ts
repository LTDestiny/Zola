import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { socketService, type SocketState } from "@/modules/chat/socket/socketService";

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET STORE - Zustand integration with singleton SocketService
//
// This store provides reactive state from the socket service.
// The actual socket logic is in socketService.ts (singleton).
// ═══════════════════════════════════════════════════════════════════════════════

const DEBUG = true;

function log(tag: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[socketStore][${tag}]`, ...args);
  }
}

type SocketStoreState = {
  connected: boolean;
  socketState: SocketState;

  // Actions
  connect: (accessToken: string) => void;
  disconnect: () => void;
  forceReconnect: () => void;
  publishTyping: (conversationId: string, typing: boolean) => Promise<void>;
  syncSubscriptions: (conversationIds: string[]) => void;
};

export const useSocketStore = create<SocketStoreState>()(
  subscribeWithSelector((set) => {
    // Subscribe to socket state changes from the singleton
    socketService.addStateListener((state) => {
      log("stateChange", state);
      set({
        socketState: state,
        connected: state === "CONNECTED",
      });
    });

    return {
      connected: socketService.isConnected(),
      socketState: socketService.getState(),

      connect: (accessToken: string) => {
        log("connect", "Connecting via socketService...");
        socketService.connect(accessToken);
      },

      disconnect: () => {
        log("disconnect", "Disconnecting...");
        socketService.disconnect();
      },

      forceReconnect: () => {
        log("forceReconnect", "Forcing reconnect...");
        socketService.forceReconnect();
      },

      publishTyping: async (conversationId: string, typing: boolean) => {
        await socketService.publishTyping(conversationId, typing);
      },

      syncSubscriptions: (conversationIds: string[]) => {
        socketService.syncConversationSubscriptions(conversationIds);
      },
    };
  })
);
