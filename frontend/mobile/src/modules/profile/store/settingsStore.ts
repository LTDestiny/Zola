import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

type Language = "English" | "Vietnamese";

type SettingsState = {
  hydrated: boolean;
  twoFactorEnabled: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  darkMode: boolean;
  language: Language;
  hydrate: () => Promise<void>;
  setTwoFactorEnabled: (value: boolean) => Promise<void>;
  setPushNotifications: (value: boolean) => Promise<void>;
  setEmailNotifications: (value: boolean) => Promise<void>;
  setDarkMode: (value: boolean) => Promise<void>;
  setLanguage: (value: Language) => Promise<void>;
};

const STORAGE_KEY = "zola.mobile.settings";

type PersistedSettings = Pick<
  SettingsState,
  "twoFactorEnabled" | "pushNotifications" | "emailNotifications" | "darkMode" | "language"
>;

const defaults: PersistedSettings = {
  twoFactorEnabled: false,
  pushNotifications: true,
  emailNotifications: true,
  darkMode: false,
  language: "English",
};

async function persist(next: PersistedSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function snapshot(state: SettingsState, patch: Partial<PersistedSettings>): PersistedSettings {
  return {
    twoFactorEnabled: patch.twoFactorEnabled ?? state.twoFactorEnabled,
    pushNotifications: patch.pushNotifications ?? state.pushNotifications,
    emailNotifications: patch.emailNotifications ?? state.emailNotifications,
    darkMode: patch.darkMode ?? state.darkMode,
    language: patch.language ?? state.language,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  ...defaults,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      set({
        ...defaults,
        ...parsed,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setTwoFactorEnabled: async (value) => {
    const next = snapshot(get(), { twoFactorEnabled: value });
    set({ twoFactorEnabled: value });
    await persist(next);
  },

  setPushNotifications: async (value) => {
    const next = snapshot(get(), { pushNotifications: value });
    set({ pushNotifications: value });
    await persist(next);
  },

  setEmailNotifications: async (value) => {
    const next = snapshot(get(), { emailNotifications: value });
    set({ emailNotifications: value });
    await persist(next);
  },

  setDarkMode: async (value) => {
    const next = snapshot(get(), { darkMode: value });
    set({ darkMode: value });
    await persist(next);
  },

  setLanguage: async (value) => {
    const next = snapshot(get(), { language: value });
    set({ language: value });
    await persist(next);
  },
}));
