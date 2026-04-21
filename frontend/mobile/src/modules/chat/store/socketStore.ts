import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { socketService, type SocketState } from "@/modules/chat/socket/socketService";

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET STORE - Zustand integration with singleton SocketService
//
// Following API spec: CHAT_1_1_FRONTEND_API.md
// Provides reactive state and typed publish methods
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
  syncSubscriptions: (conversationIds: string[]) => void;

  // Publish methods per API spec
  publishSend: (
    conversationId: string,
    content: string,
    type?: "TEXT" | "EMOJI" | "FILE" | "FORWARD",
    fileUrl?: string | null,
    fileName?: string | null,
    clientMessageId?: string | null,
  ) => Promise<void>;
  publishTyping: (conversationId: string, typing: boolean) => Promise<void>;
  publishRead: (conversationId: string, messageId: string) => Promise<void>;
  publishRecall: (conversationId: string, messageId: string) => Promise<void>;
  publishEdit: (conversationId: string, messageId: string, content: string) => Promise<void>;
  publishDeleteForMe: (conversationId: string, messageId: string) => Promise<void>;
  publishForward: (
    sourceConversationId: string,
    messageId: string,
    targetConversationId: string,
  ) => Promise<void>;
  publishReact: (
    conversationId: string,
    messageId: string,
    emoji: string,
    remove?: boolean,
  ) => Promise<void>;
};

export const useSocketStore = create<SocketStoreState>()(
  subscribeWithSelector((set) => {
    // Subscribe to socket state changes from the singleton
    socketService.addStateListener((state) => {
      log("stateChange", state);
      set({ connected: state === "CONNECTED", socketState: state });
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

      syncSubscriptions: (conversationIds: string[]) => {
        socketService.syncConversationSubscriptions(conversationIds);
      },

      // Publish methods per API spec
      publishSend: async (
        conversationId: string,
        content: string,
        type = "TEXT" as const,
        fileUrl = null,
        fileName = null,
        clientMessageId = null,
      ) => {
        await socketService.publishSend(
          conversationId,
          content,
          type,
          fileUrl,
          fileName,
          clientMessageId,
        );
      },

      publishTyping: async (conversationId: string, typing: boolean) => {
        await socketService.publishTyping(conversationId, typing);
      },

      publishRead: async (conversationId: string, messageId: string) => {
        await socketService.publishRead(conversationId, messageId);
      },

      publishRecall: async (conversationId: string, messageId: string) => {
        await socketService.publishRecall(conversationId, messageId);
      },

      publishEdit: async (conversationId: string, messageId: string, content: string) => {
        await socketService.publishEdit(conversationId, messageId, content);
      },

      publishDeleteForMe: async (conversationId: string, messageId: string) => {
        await socketService.publishDeleteForMe(conversationId, messageId);
      },

      publishForward: async (
        sourceConversationId: string,
        messageId: string,
        targetConversationId: string,
      ) => {
        await socketService.publishForward(
          sourceConversationId,
          messageId,
          targetConversationId,
        );
      },

      publishReact: async (
        conversationId: string,
        messageId: string,
        emoji: string,
        remove = false,
      ) => {
        await socketService.publishReact(conversationId, messageId, emoji, remove);
      },
    };
  })
);
