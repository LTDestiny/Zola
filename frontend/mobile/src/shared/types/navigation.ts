import type { ConversationItem } from "./api";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyRegisterOtp: { email: string };
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: { conversation: ConversationItem };
  GroupSettings: { conversation: ConversationItem };
  UserProfile: { userId: string };
};

export type RootTabParamList = {
  Chats: undefined;
  Contacts: undefined;
  Profile: undefined;
};
