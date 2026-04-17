import type { ConversationItem } from "./api";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: { conversation: ConversationItem };
};

export type RootTabParamList = {
  Chats: undefined;
  FriendRequests: undefined;
  Profile: undefined;
};
