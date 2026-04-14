import { create } from "zustand";

type SocketState = {
  connected: boolean;
  publishTyping: (conversationId: string, typing: boolean) => void;
  setConnected: (connected: boolean) => void;
  setPublishTyping: (handler: (conversationId: string, typing: boolean) => void) => void;
};

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  publishTyping: () => undefined,
  setConnected: (connected) => set({ connected }),
  setPublishTyping: (handler) => set({ publishTyping: handler }),
}));
