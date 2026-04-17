import { create } from "zustand";

type FriendRequestStore = {
    unreadCount: number;
    increment: () => void;
    reset: () => void;
};

export const useFriendRequestStore = create<FriendRequestStore>((set) => ({
    unreadCount: 0,
    increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
    reset: () => set({ unreadCount: 0 }),
}));
