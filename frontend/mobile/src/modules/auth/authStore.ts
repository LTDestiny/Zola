import { create } from "zustand";
import { clearAuthTokens, getAccessToken, isAuthenticated, saveAuthTokens } from "@/shared/storage/authToken";
import type { AuthTokenPayload, UserProfile } from "@/shared/types/api";

type AuthState = {
  bootstrapped: boolean;
  isLoggedIn: boolean;
  accessToken: string | null;
  me: UserProfile | null;
  bootstrap: () => Promise<void>;
  loginSuccess: (payload: AuthTokenPayload) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  bootstrapped: false,
  isLoggedIn: false,
  accessToken: null,
  me: null,

  bootstrap: async () => {
    const [ok, token] = await Promise.all([isAuthenticated(), getAccessToken()]);
    set({
      bootstrapped: true,
      isLoggedIn: ok,
      accessToken: ok ? token : null,
    });
  },

  loginSuccess: async (payload) => {
    await saveAuthTokens(payload);
    set({
      isLoggedIn: true,
      accessToken: payload.accessToken,
    });
  },

  setProfile: (profile) => set({ me: profile }),

  logout: async () => {
    await clearAuthTokens();
    set({
      isLoggedIn: false,
      accessToken: null,
      me: null,
    });
  },
}));
