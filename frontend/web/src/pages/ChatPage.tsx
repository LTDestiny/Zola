import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import {
  acceptFriendRequest,
  addReaction,
  addFriend,
  createDirectConversation,
  createGroupConversation,
  deleteMyProfile,
  deleteForMe,
  declineFriendRequest,
  editMessage,
  forwardMessage,
  getConversations,
  getFriends,
  getFriendshipStatus,
  getMessages,
  getMyProfile,
  getPendingFriendRequests,
  getPendingFriendRequestsUnreadCount,
  getUserSummary,
  markConversationRead,
  getUsersPresence,
  markPendingFriendRequestsRead,
  removeFriend,
  readMessage,
  recallMessage,
  removeReaction,
  searchUserByEmail,
  sendMessage,
  toApiErrorMessage,
  updateMyProfile,
  type ConversationItem,
  type FriendContactItem,
  type MessageItem,
  type PendingFriendRequestItem,
  type UserProfile,
} from "../api/chatApi";
import { uploadMedia } from "../api/mediaApi";
import {
  ChatRealtimeClient,
  type ChatRealtimeEvent,
  type PresenceRealtimeEvent,
} from "../api/chatRealtime";
import { clearAuthTokens, getAccessToken, getSessionId } from "../auth/token";
import { useLanguage } from "../i18n/language";
import { Chat } from "./chat";
import { AddFriendModal } from "./components/AddFriendModal";
import { ForwardMessageModal } from "./components/ForwardMessageModal";
import { Sidebar } from "./components/Sidebar";
// @ts-expect-error JSX module without TS declarations
import { CreateGroupModal } from "./components/CreateGroupModal.jsx";
// @ts-expect-error JSX module without TS declarations
import { GroupChat } from "./components/GroupChat.jsx";
import type { ChatListItem } from "./components/ChatList";
import type { MiniNavTab } from "./components/MiniNav";
import { useChatStore } from "../stores/chatStore";
import { useTyping } from "../hooks/useTyping";

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toPolicyViolationMessage(
  error: unknown,
  action: "edit" | "recall",
  language: "vi" | "en",
) {
  const fallback = toApiErrorMessage(error);
  const status =
    (error as { response?: { status?: number } })?.response?.status ?? 0;
  const rawMessage = fallback.toLowerCase();

  if (
    action === "edit" &&
    status === 403 &&
    rawMessage.includes("edit") &&
    rawMessage.includes("window") &&
    rawMessage.includes("expired")
  ) {
    return language === "vi"
      ? "Khong the sua tin nhan vi qua 15p"
      : "Cannot edit this message after 15 minutes";
  }

  if (
    action === "recall" &&
    status === 403 &&
    rawMessage.includes("recall") &&
    rawMessage.includes("window") &&
    rawMessage.includes("expired")
  ) {
    return language === "vi"
      ? "Khong the thu hoi tin nhan sau 24h"
      : "Cannot recall this message after 24 hours";
  }

  return fallback;
}

type ChatTab = MiniNavTab;

type PendingUploadItem = {
  localId: string;
  fileName: string;
  fileSizeLabel: string;
  mediaKind: "image" | "video" | "file";
  status: "uploading" | "failed";
  progress: number;
  errorMessage?: string;
};

function inferMediaKind(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return "file";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let next = value;
  let index = 0;
  while (next >= 1024 && index < units.length - 1) {
    next /= 1024;
    index += 1;
  }
  return `${next.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

type UserPresenceState = {
  online: boolean;
  lastChangedAt: string | null;
};

export function ChatPage() {
  const { language } = useLanguage();

  const [searchText, setSearchText] = useState("");
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.selectedConversationId);
  const totalUnreadCount = useChatStore((state) => state.totalUnreadCount);
  const setConversationList = useChatStore((state) => state.setConversations);
  const setActiveConversationId = useChatStore((state) => state.setSelectedConversationId);
  const upsertConversation = useChatStore((state) => state.upsertConversation);
  const markConversationReadLocal = useChatStore((state) => state.markConversationRead);
  const syncTotalUnread = useChatStore((state) => state.syncTotalUnread);

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileGender, setProfileGender] = useState("");
  const [profileBirthdate, setProfileBirthdate] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  const markMessageAsRead = async (
    conversationId: string,
    messageId: string,
  ) => {
    const realtimeSent = Boolean(
      realtimeClientRef.current?.publishRead(conversationId, messageId),
    );

    if (realtimeSent) {
      return;
    }

    try {
      await readMessage(conversationId, messageId);
    } catch (error) {
      // Avoid unhandled promise rejection when gateway has stale routes.
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const syncConversationReadState = async (
    conversationId: string,
    messageId: string,
  ) => {
    // Prefer realtime read receipt first so sender sees "seen" immediately.
    await markMessageAsRead(conversationId, messageId);

    // Persist read cursor when endpoint is available; safely degrade on older deployments.
    await markConversationRead(conversationId, messageId).catch(() => {
      // Keep UI responsive even if API gateway lags behind deployment.
    });
  };

  const [draftMessage, setDraftMessage] = useState("");

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState("NONE");
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);
  const [isSubmittingFriend, setIsSubmittingFriend] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    PendingFriendRequestItem[]
  >([]);
  const [
    pendingFriendRequestsUnreadCount,
    setPendingFriendRequestsUnreadCount,
  ] = useState(0);
  const [friendContacts, setFriendContacts] = useState<FriendContactItem[]>([]);
  const [userProfileMap, setUserProfileMap] = useState<
    Record<string, UserProfile>
  >({});
  const [processingFriendshipId, setProcessingFriendshipId] = useState<
    string | null
  >(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadItem[]>([]);
  const [uploadLimitModalMessage, setUploadLimitModalMessage] = useState<string | null>(null);

  const [bannerMessage, setBannerMessage] = useState("");
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("messages");
  const [isChatViewportAtBottom, setIsChatViewportAtBottom] = useState(true);
  const [userPresenceMap, setUserPresenceMap] = useState<
    Record<string, UserPresenceState>
  >({});
  const [presenceTick, setPresenceTick] = useState(Date.now());

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;

  const realtimeClientRef = useRef<ChatRealtimeClient | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const refreshConversationsTimeoutRef = useRef<number | null>(null);
  const isSilentRefreshingRef = useRef(false);
  const conversationIdsRef = useRef<string[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const activeTabRef = useRef<ChatTab>("messages");
  const isChatViewportAtBottomRef = useRef(true);
  const hasUserOpenedConversationRef = useRef(false);
  const manuallyOpenedConversationIdRef = useRef<string | null>(null);
  const pendingReadSyncOnOpenRef = useRef(false);
  const userProfileMapRef = useRef<Record<string, UserProfile>>({});
  const myUserIdRef = useRef<string | null>(null);
  const processedRealtimeMessageIdsRef = useRef<Set<string>>(new Set());
  const processedRealtimeSendIdsRef = useRef<Set<string>>(new Set());
  const messageLoadRequestIdRef = useRef(0);
  const uploadAbortControllersRef = useRef<Record<string, AbortController>>({});
  const uploadFileRegistryRef = useRef<Record<string, { file: File; caption: string; conversationId: string }>>({});

  // ─── TYPING INDICATOR HOOK (debounced, auto-stop) ────────────────────────────
  const publishTypingFn = useCallback((conversationId: string, typing: boolean) => {
    const client = realtimeClientRef.current;
    if (!client || !client.isConnected()) return false;
    const conversation = useChatStore
      .getState()
      .conversations.find((item) => item.id === conversationId);
    if (conversation?.type === "group") {
      return client.publishTypingGroup(conversationId, typing);
    }
    return client.publishTyping(conversationId, typing);
  }, []);

  const {
    onTextChange: onTypingTextChange,
    onSendMessage: onTypingSendMessage
  } = useTyping(activeConversationId, publishTypingFn);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isChatViewportAtBottomRef.current = isChatViewportAtBottom;
  }, [isChatViewportAtBottom]);

  useEffect(() => {
    conversationIdsRef.current = conversations.map((conversation) => conversation.id);
  }, [conversations]);

  useEffect(() => {
    myUserIdRef.current = myProfile?.id ?? null;
  }, [myProfile?.id]);

  useEffect(() => {
    userProfileMapRef.current = userProfileMap;
  }, [userProfileMap]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setPresenceTick(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const mergePresence = (
    entries: Array<{
      userId: string;
      online: boolean;
      lastChangedAt: string | null;
    }>,
  ) => {
    if (entries.length === 0) {
      return;
    }

    setUserPresenceMap((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        next[entry.userId] = {
          online: entry.online,
          lastChangedAt: entry.lastChangedAt,
        };
      });
      return next;
    });
  };

  const refreshPresenceData = async (userIds: string[]) => {
    const normalizedUserIds = Array.from(
      new Set(userIds.map((value) => value.trim()).filter(Boolean)),
    );
    if (normalizedUserIds.length === 0) {
      return;
    }

    try {
      const result = await getUsersPresence(normalizedUserIds);
      mergePresence(result.data ?? []);
    } catch {
      // Keep the current presence snapshot if transient request fails.
    }
  };

  const toPresenceLabel = (presence: UserPresenceState | undefined) => {
    if (!presence) {
      return language === "vi" ? "Offline" : "Offline";
    }

    if (presence.online) {
      return language === "vi" ? "Online" : "Online";
    }

    if (!presence.lastChangedAt) {
      return language === "vi" ? "Offline" : "Offline";
    }

    const changedAt = new Date(presence.lastChangedAt).getTime();
    if (Number.isNaN(changedAt)) {
      return language === "vi" ? "Offline" : "Offline";
    }

    const minutes = Math.max(0, Math.floor((presenceTick - changedAt) / 60000));
    if (minutes < 60) {
      return language === "vi"
        ? `Truy cap ${Math.max(1, minutes)} phut truoc`
        : `Last seen ${Math.max(1, minutes)} min ago`;
    }

    if (minutes < 24 * 60) {
      const hours = Math.max(1, Math.floor(minutes / 60));
      return language === "vi"
        ? `Truy cap ${hours}h truoc`
        : `Last seen ${hours}h ago`;
    }

    const formattedDate = new Intl.DateTimeFormat(
      language === "vi" ? "vi-VN" : "en-US",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    ).format(new Date(changedAt));
    return language === "vi"
      ? `Truy cap lan cuoi ${formattedDate}`
      : `Last seen on ${formattedDate}`;
  };

  const getPresenceForUser = (
    userId: string,
  ): UserPresenceState | undefined => {
    const profilePresence = userProfileMap[userId];
    const realtimePresence = userPresenceMap[userId];

    const hasProfileOnline = typeof profilePresence?.isOnline === "boolean";
    const hasRealtimeOnline = typeof realtimePresence?.online === "boolean";
    const online = hasProfileOnline
      ? Boolean(profilePresence?.isOnline)
      : hasRealtimeOnline
        ? Boolean(realtimePresence?.online)
        : false;
    const lastChangedAt =
      profilePresence?.lastSeenAt ?? realtimePresence?.lastChangedAt ?? null;

    if (!hasRealtimeOnline && !hasProfileOnline && !lastChangedAt) {
      return undefined;
    }

    return {
      online,
      lastChangedAt,
    };
  };

  const resolvePeerUserId = (conversation: ConversationItem) => {
    if (conversation.type === "group") {
      return conversation.ownerId ?? conversation.participants?.[0] ?? conversation.name;
    }
    const myId = myProfile?.id ?? null;
    const peer = conversation.participants?.find((id) => id && id !== myId);
    if (peer) {
      return peer;
    }
    return conversation.name;
  };

  const getConversationDisplayName = (conversation: ConversationItem) => {
    if (conversation.type === "group") {
      return conversation.name || (language === "vi" ? "Nhom" : "Group");
    }

    const peerUserId = resolvePeerUserId(conversation);
    const profile = userProfileMap[peerUserId];
    if (profile?.fullName) {
      return profile.fullName;
    }

    if (conversation.name && !conversation.name.includes("-")) {
      return conversation.name;
    }

    if (peerUserId && peerUserId.length >= 8) {
      return `User ${peerUserId.slice(0, 8)}`;
    }

    return conversation.name || "User";
  };

  const normalizeFriendshipStatus = (status: string | null | undefined) => {
    const normalized = (status ?? "").trim().toUpperCase();
    if (
      normalized === "PENDING" ||
      normalized === "ACCEPTED" ||
      normalized === "NONE"
    ) {
      return normalized;
    }
    if (normalized === "DELETED") {
      return "NONE";
    }
    return normalized || "NONE";
  };

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [activeConversationId, conversations],
  );

  const filteredConversations = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) => {
      const displayName = getConversationDisplayName(conversation);
      return (
        displayName.toLowerCase().includes(normalized) ||
        conversation.lastMessage.toLowerCase().includes(normalized)
      );
    });
  }, [conversations, searchText, userProfileMap, myProfile?.id]);

  const sidebarChats = useMemo<ChatListItem[]>(() => {
    return filteredConversations.map((conversation) => {
      const displayName = getConversationDisplayName(conversation);
      const isGroupConversation = conversation.type === "group";
      const presence = isGroupConversation
        ? undefined
        : getPresenceForUser(resolvePeerUserId(conversation));
      const groupPresenceLabel = `${conversation.participants?.length ?? 0} ${language === "vi" ? "thanh vien" : "members"}`;
      return {
        id: conversation.id,
        name: displayName,
        avatar: initials(displayName),
        avatarUrl: conversation.avatar ?? undefined,
        timestamp: conversation.lastMessageAt
          ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(conversation.lastMessageAt))
          : "--:--",
        lastMessage: conversation.lastMessage || "...",
        unreadCount: conversation.unreadCount ?? 0,
        isOnline: isGroupConversation ? false : presence?.online ?? false,
        presenceLabel: isGroupConversation ? groupPresenceLabel : toPresenceLabel(presence),
      };
    });
  }, [
    filteredConversations,
    language,
    presenceTick,
    userPresenceMap,
    userProfileMap,
    myProfile?.id,
  ]);

  const fetchConversations = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent && isSilentRefreshingRef.current) {
      return;
    }

    try {
      if (silent) {
        isSilentRefreshingRef.current = true;
      } else {
        setIsLoadingConversations(true);
      }
      const result = await getConversations();
      const incomingItems = result.data ?? [];
      const activeId = activeConversationIdRef.current;

      let items = incomingItems;
      if (silent && activeId && !incomingItems.some((item) => item.id === activeId)) {
        const existingActive = useChatStore
          .getState()
          .conversations.find((item) => item.id === activeId);
        if (existingActive) {
          items = [
            ...incomingItems,
            {
              ...existingActive,
              type: existingActive.type ?? "private",
              avatar: existingActive.avatar ?? null,
              unreadCount: existingActive.unreadCount ?? 0,
              lastReadAt: existingActive.lastReadAt ?? null,
              lastReadMessageId: existingActive.lastReadMessageId ?? null,
              admins: existingActive.admins ?? [],
              ownerId: existingActive.ownerId ?? null,
            },
          ];
        }
      }

      setConversationList(items);

      const myId = myUserIdRef.current;
      const participantIds = Array.from(
        new Set(
          items.flatMap((item) => {
            const peers = item.participants?.filter((id) => id && id !== myId);
            if (peers && peers.length > 0) {
              return peers;
            }
            return item.name ? [item.name] : [];
          }),
        ),
      );
      await refreshPresenceData(participantIds);

      const missingProfileIds = participantIds.filter((id) => !userProfileMapRef.current[id]);
      if (missingProfileIds.length > 0) {
        const fetchedProfiles = await Promise.all(
          missingProfileIds.map(async (id) => {
            try {
              const profile = await getUserSummary(id);
              return profile.data;
            } catch {
              return null;
            }
          }),
        );

        const profileMap: Record<string, UserProfile> = {};
        fetchedProfiles.forEach((profile) => {
          if (profile) {
            profileMap[profile.id] = profile;
          }
        });

        if (Object.keys(profileMap).length > 0) {
          setUserProfileMap((prev) => ({
            ...prev,
            ...profileMap,
          }));
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // FIX: Do NOT auto-select first conversation on initial load
      // This ensures:
      // - Login → /messages shows Welcome Screen
      // - Refresh /messages → shows Welcome Screen  
      // - Tab switch → shows Welcome Screen
      // Only clear selection if the selected conversation no longer exists
      // ═══════════════════════════════════════════════════════════════════════
      if (
        !silent &&
        activeId &&
        !items.some((conversation) => conversation.id === activeId)
      ) {
        hasUserOpenedConversationRef.current = false;
        manuallyOpenedConversationIdRef.current = null;
        setActiveConversationId(null);  // Clear, don't auto-select first
      }
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      if (silent) {
        isSilentRefreshingRef.current = false;
      } else {
        setIsLoadingConversations(false);
      }
    }
  };

  const scheduleConversationsRefresh = () => {
    if (refreshConversationsTimeoutRef.current) {
      return;
    }

    refreshConversationsTimeoutRef.current = window.setTimeout(() => {
      refreshConversationsTimeoutRef.current = null;
      void fetchConversations({ silent: true });
    }, 400);
  };

  const fetchFriendshipData = async () => {
    try {
      const [pendingResult, friendsResult, unreadResult] = await Promise.all([
        getPendingFriendRequests(),
        getFriends(),
        getPendingFriendRequestsUnreadCount(),
      ]);

      const pending = pendingResult.data ?? [];
      const friends = friendsResult.data ?? [];
      setPendingFriendRequests(pending);
      setFriendContacts(friends);
      setPendingFriendRequestsUnreadCount(
        Math.max(0, unreadResult.data?.count ?? 0),
      );

      const ids = Array.from(
        new Set([
          ...pending.map((item) => item.requesterId),
          ...friends.map((item) => item.userId),
        ]),
      );

      await refreshPresenceData(ids);

      const fetchedProfiles = await Promise.all(
        ids.map(async (id) => {
          try {
            const profile = await getUserSummary(id);
            return profile.data;
          } catch {
            return null;
          }
        }),
      );

      const profileMap: Record<string, UserProfile> = {};
      fetchedProfiles.forEach((profile) => {
        if (profile) {
          profileMap[profile.id] = profile;
        }
      });
      setUserProfileMap((prev) => ({
        ...prev,
        ...profileMap,
      }));
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  useEffect(() => {
    void fetchConversations();
    void fetchFriendshipData();
  }, []);

  useEffect(() => {
    if (isRealtimeConnected) {
      return;
    }

    const refreshInterval = window.setInterval(() => {
      void fetchConversations({ silent: true });
    }, 8000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [isRealtimeConnected]);

  useEffect(() => {
    if (!myProfile?.id) {
      return;
    }
    void fetchConversations({ silent: true });
  }, [myProfile?.id]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await getMyProfile();
        setMyProfile(result.data);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      }
    };
    void loadProfile();
  }, []);

  useEffect(() => {
    setProfileFullName(myProfile?.fullName ?? "");
    setProfilePhone(myProfile?.phone ?? "");
    setProfileAvatarUrl(myProfile?.avatarUrl ?? "");
    setProfileGender((myProfile?.gender ?? "").toUpperCase());
    setProfileBirthdate(myProfile?.birthdate ?? "");
  }, [myProfile]);

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    const client = new ChatRealtimeClient(accessToken, {
      onConnect: () => {
        setIsRealtimeConnected(true);
        client.subscribeUserQueue();
        client.syncConversationSubscriptions(conversationIdsRef.current);
      },
      onDisconnect: () => {
        setIsRealtimeConnected(false);
      },
      onError: (message) => {
        const normalized = message.toLowerCase();
        if (
          normalized.includes("edit") &&
          normalized.includes("window") &&
          normalized.includes("expired")
        ) {
          setBannerMessage(
            language === "vi"
              ? "Khong the sua tin nhan vi qua 15p"
              : "Cannot edit this message after 15 minutes",
          );
          return;
        }

        if (
          normalized.includes("recall") &&
          normalized.includes("window") &&
          normalized.includes("expired")
        ) {
          setBannerMessage(
            language === "vi"
              ? "Khong the thu hoi tin nhan sau 24h"
              : "Cannot recall this message after 24 hours",
          );
          return;
        }

        setBannerMessage(message);
      },
      onEvent: (event: ChatRealtimeEvent) => {
        const selectedConversationId =
          useChatStore.getState().selectedConversationId ??
          activeConversationIdRef.current;

        const isTypingEvent =
          event.eventType === "TYPING" ||
          event.eventType === "user_typing_group";
        const isConversationSyncEvent =
          event.eventType === "CONVERSATION_UPDATED" ||
          event.eventType === "UNREAD_COUNT_UPDATED" ||
          event.eventType === "TOTAL_UNREAD_UPDATED" ||
          event.eventType === "group_created";
        const isMessageEvent =
          event.eventType === "NEW_MESSAGE" ||
          event.eventType === "MESSAGE_SENT" ||
          event.eventType === "new_group_message" ||
          event.eventType === "message_replied";

        if (isTypingEvent) {
          if (event.actorId !== myUserIdRef.current) {
            setTypingUserId(event.typing ? event.actorId : null);

            // Auto-clear typing after 5s if stuck (anti-stuck protection)
            if (event.typing) {
              setTimeout(() => {
                setTypingUserId((current) =>
                  current === event.actorId ? null : current
                );
              }, 5000);
            }
          }
          return;
        }

        if (isConversationSyncEvent) {
          if (event.conversationId) {
            upsertConversation({
              id: event.conversationId,
              lastMessage: event.lastMessage ?? undefined,
              lastMessageAt: event.lastMessageAt ?? undefined,
              unreadCount: event.unreadCount ?? undefined,
            });
          }
          if (typeof event.totalUnreadCount === "number") {
            syncTotalUnread(event.totalUnreadCount);
          }

          // Keep sidebar and unread counters accurate even when realtime payload is partial.
          scheduleConversationsRefresh();
        }

        const payload = event.message;
        if (!payload) {
          return;
        }

        // Clear typing indicator when message arrives from this conversation
        if (
          isMessageEvent &&
          event.conversationId === activeConversationIdRef.current
        ) {
          setTypingUserId(null);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // CRITICAL FIX: Deduplicate by messageId ONLY (not by eventType)
        // Backend sends same message to BOTH topic and user queue
        // MESSAGE_SENT and NEW_MESSAGE for same messageId = duplicate!
        // ═══════════════════════════════════════════════════════════════════════
        if (isMessageEvent) {
          // Use just messageId - NOT including eventType
          // This catches duplicates across MESSAGE_SENT and NEW_MESSAGE
          const dedupKey = `msg:${payload.messageId}`;
          if (processedRealtimeSendIdsRef.current.has(dedupKey)) {
            console.log(`[ChatPage] Duplicate message ignored: ${dedupKey}`);
            return;
          }
          processedRealtimeSendIdsRef.current.add(dedupKey);
          if (processedRealtimeSendIdsRef.current.size > 800) {
            const first = processedRealtimeSendIdsRef.current.values().next().value;
            if (first) {
              processedRealtimeSendIdsRef.current.delete(first);
            }
          }
        }

        // Secondary dedup check (legacy, now unified above)
        const messageKey = `msg:${payload.messageId}`;
        if (event.eventType === "NEW_MESSAGE" || event.eventType === "new_group_message") {
          if (processedRealtimeMessageIdsRef.current.has(messageKey)) {
            return;
          }
          processedRealtimeMessageIdsRef.current.add(messageKey);
          if (processedRealtimeMessageIdsRef.current.size > 500) {
            const first = processedRealtimeMessageIdsRef.current.values().next().value;
            if (first) {
              processedRealtimeMessageIdsRef.current.delete(first);
            }
          }
        }

        const normalizedMessage: MessageItem = {
          id: payload.messageId,
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          receiverId: payload.receiverId,
          type: payload.type,
          content: payload.recalled
            ? "This message was recalled"
            : payload.content,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
          parentMessageId: payload.parentMessageId ?? null,
          reactions: payload.reactions,
          reactionEntries: payload.reactionEntries,
          recalled: payload.recalled,
          edited: payload.edited,
          deletedForUsers: payload.deletedForUsers,
          deliveredTo: payload.deliveredTo,
          seenBy: payload.seenBy,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt,
        };

        const isDeletedForMe = payload.deletedForUsers?.includes(
          myUserIdRef.current ?? "",
        );
        if (isDeletedForMe) {
          setMessages((prev) =>
            prev.filter((item) => item.id !== payload.messageId),
          );
          return;
        }

        if (event.conversationId === selectedConversationId) {
          setMessages((prev) => {
            const existingIndex = prev.findIndex(
              (item) => item.id === normalizedMessage.id,
            );
            let next =
              existingIndex >= 0
                ? prev.map((item) =>
                  item.id === normalizedMessage.id ? normalizedMessage : item,
                )
                : [...prev, normalizedMessage];

            if (
              event.eventType === "READ_RECEIPT" &&
              event.actorId &&
              event.actorId !== myUserIdRef.current
            ) {
              const readUpToIndex = next.findIndex(
                (item) => item.id === normalizedMessage.id,
              );
              if (readUpToIndex >= 0) {
                next = next.map((item, index) => {
                  if (index > readUpToIndex || item.senderId !== myUserIdRef.current) {
                    return item;
                  }

                  const seenBy = new Set(item.seenBy ?? []);
                  seenBy.add(event.actorId);

                  const deliveredTo = new Set(item.deliveredTo ?? []);
                  deliveredTo.add(event.actorId);

                  return {
                    ...item,
                    seenBy: Array.from(seenBy),
                    deliveredTo: Array.from(deliveredTo),
                  };
                });
              }
            }

            return next;
          });

          if (
            isMessageEvent &&
            normalizedMessage.senderId !== myUserIdRef.current
          ) {
            const isManualOpenForCurrentConversation =
              selectedConversationId === manuallyOpenedConversationIdRef.current;
            const canAutoRead =
              hasUserOpenedConversationRef.current &&
              isManualOpenForCurrentConversation &&
              activeTabRef.current === "messages" &&
              isChatViewportAtBottomRef.current &&
              document.visibilityState === "visible" &&
              document.hasFocus();
            if (canAutoRead) {
              void markMessageAsRead(event.conversationId, normalizedMessage.id);
              markConversationReadLocal(event.conversationId);
            }
          }
        }

        let unreadPatch = event.unreadCount ?? undefined;
        const isIncomingFromOtherUser =
          normalizedMessage.senderId !== myUserIdRef.current;
        const isActiveConversation =
          event.conversationId === selectedConversationId;
        const isManualOpenForActiveConversation =
          selectedConversationId === manuallyOpenedConversationIdRef.current;
        const isViewingActiveConversation =
          hasUserOpenedConversationRef.current &&
          isActiveConversation &&
          isManualOpenForActiveConversation &&
          activeTabRef.current === "messages" &&
          isChatViewportAtBottomRef.current &&
          document.visibilityState === "visible" &&
          document.hasFocus();
        const isIncomingMessageEvent =
          isMessageEvent;

        if (isIncomingFromOtherUser && !isViewingActiveConversation && isIncomingMessageEvent) {
          const currentConversation = useChatStore
            .getState()
            .conversations.find((item) => item.id === event.conversationId);
          const currentUnread = Math.max(0, currentConversation?.unreadCount ?? 0);
          const nextUnread = currentUnread + 1;
          if (typeof unreadPatch !== "number" || unreadPatch <= currentUnread) {
            unreadPatch = nextUnread;
          }
        }

        upsertConversation({
          id: event.conversationId,
          lastMessage: normalizedMessage.content,
          lastMessageAt: normalizedMessage.createdAt,
          unreadCount: unreadPatch,
        });
      },
      onSyncEvent: (event) => {
        if (event.eventType.startsWith("FRIENDSHIP_")) {
          void fetchFriendshipData();
          if (
            event.eventType === "FRIENDSHIP_REQUEST_ACCEPTED" ||
            event.eventType === "FRIENDSHIP_CHAT_READY"
          ) {
            void fetchConversations();
          }
          return;
        }

        if (event.eventType === "PROFILE_UPDATED") {
          void fetchFriendshipData();
          try {
            const payload = event.payload ? JSON.parse(event.payload) : null;
            const updatedUserId = payload?.userId as string | undefined;
            if (!updatedUserId || updatedUserId === myUserIdRef.current) {
              void (async () => {
                try {
                  const result = await getMyProfile();
                  setMyProfile(result.data);
                } catch {
                  // Ignore transient profile refresh errors.
                }
              })();
            }
          } catch {
            // Ignore malformed payload.
          }
          return;
        }

        if (event.eventType === "PROFILE_DELETED") {
          clearAuthTokens();
          window.location.replace("/login");
          return;
        }

        if (event.eventType === "SESSION_REVOKED") {
          const currentSessionId = getSessionId();
          try {
            const payload = event.payload ? JSON.parse(event.payload) : null;
            const revokedSessionId = payload?.sessionId as string | undefined;
            if (
              currentSessionId &&
              revokedSessionId &&
              currentSessionId === revokedSessionId
            ) {
              const forcedLogoutMessage =
                language === "vi"
                  ? "Tai khoan da dang nhap o thiet bi khac. Vui long dang nhap lai."
                  : "Your account signed in on another device. Please sign in again.";
              sessionStorage.setItem(
                "zola_forced_logout_message",
                forcedLogoutMessage,
              );
              clearAuthTokens();
              window.location.replace("/login");
            }
          } catch {
            // Ignore malformed payload and keep current session.
          }
        }
      },
      onPresenceEvent: (event: PresenceRealtimeEvent) => {
        mergePresence([
          {
            userId: event.userId,
            online: event.online,
            lastChangedAt: event.lastSeenAt ?? event.lastChangedAt ?? null,
          },
        ]);
      },
    });

    client.connect();
    realtimeClientRef.current = client;

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (refreshConversationsTimeoutRef.current) {
        window.clearTimeout(refreshConversationsTimeoutRef.current);
        refreshConversationsTimeoutRef.current = null;
      }
      realtimeClientRef.current?.disconnect();
      realtimeClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isRealtimeConnected) {
      setTypingUserId(null);
      return;
    }

    const client = realtimeClientRef.current;
    if (client && client.isConnected()) {
      client.syncConversationSubscriptions(conversations.map((conversation) => conversation.id));
    }

    if (!activeConversationId) {
      setTypingUserId(null);
    }
  }, [activeConversationId, conversations, isRealtimeConnected]);

  useEffect(() => {
    if (!activeConversationId) {
      messageLoadRequestIdRef.current += 1;
      setMessages([]);
      setNextCursor(null);
      return;
    }

    // Avoid carrying stale message ids from previous conversation into read-sync effects.
    setMessages([]);
    setNextCursor(null);

    const targetConversationId = activeConversationId;
    const requestId = messageLoadRequestIdRef.current + 1;
    messageLoadRequestIdRef.current = requestId;

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const result = await getMessages(targetConversationId, {
          cursor: null,
          limit: 50,
        });
        if (
          requestId !== messageLoadRequestIdRef.current ||
          activeConversationIdRef.current !== targetConversationId
        ) {
          return;
        }
        const items = result.data?.items ?? [];
        setMessages(items.slice().reverse());
        setNextCursor(result.data?.nextCursor ?? null);
      } catch (error) {
        if (requestId === messageLoadRequestIdRef.current) {
          setBannerMessage(toApiErrorMessage(error));
        }
      } finally {
        if (requestId === messageLoadRequestIdRef.current) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const isViewingMessages =
      hasUserOpenedConversationRef.current &&
      activeConversationId === manuallyOpenedConversationIdRef.current &&
      activeTab === "messages" &&
      isChatViewportAtBottom &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    const shouldSyncAfterManualOpen =
      pendingReadSyncOnOpenRef.current &&
      hasUserOpenedConversationRef.current &&
      activeConversationId === manuallyOpenedConversationIdRef.current &&
      activeTab === "messages" &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    if (!isViewingMessages && !shouldSyncAfterManualOpen) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const latestMessageId =
      latestMessage && latestMessage.conversationId === activeConversationId
        ? latestMessage.id
        : null;
    if (!latestMessageId) {
      return;
    }
    markConversationReadLocal(activeConversationId);
    pendingReadSyncOnOpenRef.current = false;
    void syncConversationReadState(activeConversationId, latestMessageId);
  }, [
    activeConversationId,
    activeTab,
    isChatViewportAtBottom,
    messages,
    markConversationReadLocal,
  ]);

  useEffect(() => {
    const syncReadWhenFocused = () => {
      if (!activeConversationIdRef.current) {
        return;
      }
      const isViewingMessages =
        hasUserOpenedConversationRef.current &&
        activeConversationIdRef.current === manuallyOpenedConversationIdRef.current &&
        activeTab === "messages" &&
        isChatViewportAtBottomRef.current &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (!isViewingMessages) {
        return;
      }
      const latestMessage = messages[messages.length - 1];
      const latestMessageId =
        latestMessage &&
          latestMessage.conversationId === activeConversationIdRef.current
          ? latestMessage.id
          : null;
      if (!latestMessageId) {
        return;
      }
      markConversationReadLocal(activeConversationIdRef.current);
      void syncConversationReadState(activeConversationIdRef.current, latestMessageId);
    };

    window.addEventListener("focus", syncReadWhenFocused);
    document.addEventListener("visibilitychange", syncReadWhenFocused);

    return () => {
      window.removeEventListener("focus", syncReadWhenFocused);
      document.removeEventListener("visibilitychange", syncReadWhenFocused);
    };
  }, [activeTab, messages, markConversationReadLocal]);

  const onLoadOlderMessages = async () => {
    if (!activeConversationId || !nextCursor || isLoadingMoreMessages) {
      return;
    }

    const targetConversationId = activeConversationId;

    try {
      setIsLoadingMoreMessages(true);
      const result = await getMessages(targetConversationId, {
        cursor: nextCursor,
        limit: 50,
      });
      if (activeConversationIdRef.current !== targetConversationId) {
        return;
      }
      const olderItems = (result.data?.items ?? []).slice().reverse();
      if (olderItems.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const uniqueOlder = olderItems.filter((item) => !existingIds.has(item.id));
          return [...uniqueOlder, ...prev];
        });
      }
      setNextCursor(result.data?.nextCursor ?? null);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "contacts" || pendingFriendRequestsUnreadCount <= 0) {
      return;
    }

    const markRead = async () => {
      try {
        await markPendingFriendRequestsRead();
        setPendingFriendRequestsUnreadCount(0);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      }
    };

    void markRead();
  }, [activeTab, pendingFriendRequestsUnreadCount]);

  const onSendMessage = async (options?: { parentMessageId?: string | null }) => {
    const content = draftMessage.trim();
    if (!content || !activeConversationId || isSending) return;

    // Stop typing indicator immediately when sending
    onTypingSendMessage();

    try {
      setIsSending(true);

      const activeConversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === activeConversationId);

      const realtimeClient = realtimeClientRef.current;
      const canSendRealtime = Boolean(realtimeClient?.isConnected());

      if (activeConversation?.type === "group" && canSendRealtime) {
        const sent = realtimeClient?.publishSendGroupMessage(
          activeConversationId,
          content,
          "TEXT",
          null,
          null,
          options?.parentMessageId ?? null,
        );

        if (sent) {
          setDraftMessage("");
          await fetchConversations({ silent: true });
          return;
        }
      }

      const result = await sendMessage(activeConversationId, content, {
        type: "TEXT",
        parentMessageId: options?.parentMessageId ?? null,
      });
      setMessages((prev) => {
        const exists = prev.some((item) => item.id === result.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, result.data];
      });
      setDraftMessage("");
      await fetchConversations();
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const validateFileBeforeUpload = (file: File) => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const mediaKind = inferMediaKind(file);

    const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
    const videoExtensions = new Set(["mp4", "mov", "webm"]);
    const fileExtensions = new Set([
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "zip",
      "rar",
      "txt",
    ]);

    if (mediaKind === "image") {
      if (!imageExtensions.has(ext)) {
        return language === "vi"
          ? "Dinh dang anh khong ho tro"
          : "Unsupported image format";
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return language === "vi" ? "Anh vuot 10MB" : "Image exceeds 10MB";
      }
      return null;
    }

    if (mediaKind === "video") {
      if (!videoExtensions.has(ext)) {
        return language === "vi"
          ? "Dinh dang video khong ho tro"
          : "Unsupported video format";
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return language === "vi"
          ? "Video vuot 100MB"
          : "Video exceeds 100MB";
      }
      return null;
    }

    if (!fileExtensions.has(ext)) {
      return language === "vi"
        ? "Dinh dang tep khong ho tro"
        : "Unsupported file format";
    }
    if (file.size > MAX_FILE_BYTES) {
      return language === "vi" ? "Tep vuot 100MB" : "File exceeds 100MB";
    }
    return null;
  };

  const sendUploadedMediaMessage = async (
    conversationId: string,
    caption: string,
    uploaded: Awaited<ReturnType<typeof uploadMedia>>,
    mediaKind: "image" | "video" | "file",
  ) => {
    const type = mediaKind === "image" ? "IMAGE" : mediaKind === "video" ? "VIDEO" : "FILE";
    const content = caption || `📎 ${uploaded.data.fileName}`;
    const result = await sendMessage(conversationId, content, {
      type,
      fileName: uploaded.data.fileName,
      fileUrl: uploaded.data.fileUrl,
    });

    setMessages((prev) => {
      const exists = prev.some((item) => item.id === result.data.id);
      if (exists) {
        return prev;
      }
      return [...prev, result.data];
    });
  };

  const uploadAndDispatch = async (localId: string) => {
    const payload = uploadFileRegistryRef.current[localId];
    if (!payload) {
      return;
    }

    const { file, caption, conversationId } = payload;
    const mediaKind = inferMediaKind(file);

    const controller = new AbortController();
    uploadAbortControllersRef.current[localId] = controller;

    try {
      const uploaded = await uploadMedia(file, {
        signal: controller.signal,
        onProgress: (percent) => {
          setPendingUploads((prev) =>
            prev.map((item) =>
              item.localId === localId
                ? { ...item, progress: percent, status: "uploading", errorMessage: undefined }
                : item,
            ),
          );
        },
      });

      await sendUploadedMediaMessage(conversationId, caption, uploaded, mediaKind);

      setPendingUploads((prev) => prev.filter((item) => item.localId !== localId));
      delete uploadFileRegistryRef.current[localId];
      delete uploadAbortControllersRef.current[localId];
    } catch (error) {
      const message = toApiErrorMessage(error);
      const isAbort =
        (error as { name?: string; code?: string })?.name === "CanceledError" ||
        (error as { name?: string; code?: string })?.name === "AbortError" ||
        (error as { name?: string; code?: string })?.code === "ERR_CANCELED";

      if (isAbort) {
        setPendingUploads((prev) => prev.filter((item) => item.localId !== localId));
        delete uploadFileRegistryRef.current[localId];
        delete uploadAbortControllersRef.current[localId];
        return;
      }

      setPendingUploads((prev) =>
        prev.map((item) =>
          item.localId === localId
            ? {
              ...item,
              status: "failed",
              errorMessage: message,
            }
            : item,
        ),
      );
      delete uploadAbortControllersRef.current[localId];
    }
  };

  const onSendFiles = async (files: File[], caption: string) => {
    if (!activeConversationId || files.length === 0) {
      return;
    }

    const validFiles: Array<{ localId: string; file: File }> = [];
    const rejectedMessages: string[] = [];
    const oversizedMessages: string[] = [];

    files.forEach((file) => {
      const error = validateFileBeforeUpload(file);
      if (error) {
        rejectedMessages.push(`${file.name}: ${error}`);
        if (error.includes("10MB") || error.includes("100MB") || error.includes("exceeds")) {
          oversizedMessages.push(`${file.name}: ${error}`);
        }
        return;
      }

      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      validFiles.push({ localId, file });
      uploadFileRegistryRef.current[localId] = {
        file,
        caption,
        conversationId: activeConversationId,
      };
    });

    if (rejectedMessages.length > 0) {
      setBannerMessage(rejectedMessages.join(" | "));
    }

    if (oversizedMessages.length > 0) {
      setUploadLimitModalMessage(oversizedMessages.join("\n"));
    }

    if (validFiles.length === 0) {
      return;
    }

    setPendingUploads((prev) => [
      ...prev,
      ...validFiles.map(({ localId, file }) => ({
        localId,
        fileName: file.name,
        fileSizeLabel: formatBytes(file.size),
        mediaKind: inferMediaKind(file),
        status: "uploading" as const,
        progress: 0,
      })),
    ]);

    await Promise.all(validFiles.map((item) => uploadAndDispatch(item.localId)));
    await fetchConversations();
  };

  const onRetryUpload = async (localId: string) => {
    const payload = uploadFileRegistryRef.current[localId];
    if (!payload) {
      return;
    }

    setPendingUploads((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
            ...item,
            progress: 0,
            status: "uploading",
            errorMessage: undefined,
          }
          : item,
      ),
    );

    await uploadAndDispatch(localId);
    await fetchConversations();
  };

  const onCancelUpload = (localId: string) => {
    const controller = uploadAbortControllersRef.current[localId];
    if (controller) {
      controller.abort();
    }
    delete uploadAbortControllersRef.current[localId];
    delete uploadFileRegistryRef.current[localId];
    setPendingUploads((prev) => prev.filter((item) => item.localId !== localId));
  };

  const onRecallMessage = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      // Persist recall via REST as the source of truth; backend will broadcast realtime to both participants.
      await recallMessage(activeConversationId, messageId);
      const recalledText =
        language === "vi" ? "Bạn đã thu hồi một tin nhắn" : "You recalled a message";
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { ...item, recalled: true, content: "This message was recalled" }
            : item,
        ),
      );
      // Optimistically update sidebar so it doesn't wait for the STOMP echo.
      upsertConversation({
        id: activeConversationId,
        lastMessage: recalledText,
        lastMessageAt: new Date().toISOString(),
      });
    } catch (error) {
      setBannerMessage(toPolicyViolationMessage(error, "recall", language));
    }
  };

  const onEditMessage = async (messageId: string, nextContent: string) => {
    if (!activeConversationId) {
      return;
    }

    const conversationId = activeConversationId;
    const previousMessage = messages.find((item) => item.id === messageId);

    try {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? {
              ...item,
              content: nextContent,
              edited: true,
              updatedAt: new Date().toISOString(),
            }
            : item,
        ),
      );

      // Single source of truth: REST edit endpoint persists and server broadcasts realtime.
      await editMessage(conversationId, messageId, nextContent);

      // Re-sync current conversation to guarantee UI consistency after server-side mutation.
      await reloadConversationMessagesWithRetry(conversationId, 3);
    } catch (error) {
      if (previousMessage) {
        setMessages((prev) =>
          prev.map((item) => (item.id === messageId ? previousMessage : item)),
        );
      }
      setBannerMessage(toPolicyViolationMessage(error, "edit", language));
    }
  };

  const onDeleteForMe = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      await deleteForMe(activeConversationId, messageId);
      setMessages((prev) => prev.filter((item) => item.id !== messageId));
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onForwardMessage = async (messageId: string) => {
    if (!activeConversationId) return;
    const targets = conversations.filter(
      (conversation) => conversation.id !== activeConversationId,
    );
    if (targets.length === 0) {
      setBannerMessage(
        language === "vi"
          ? "Khong co hoi thoai de chuyen tiep"
          : "No target conversation to forward",
      );
      return;
    }
    setForwardMessageId(messageId);
    setIsForwardModalOpen(true);
  };

  const onConfirmForwardTargets = async ({
    targetConversationIds,
    targetUserIds,
  }: {
    targetConversationIds: string[];
    targetUserIds: string[];
  }) => {
    if (!activeConversationId || !forwardMessageId) {
      return;
    }

    try {
      setIsForwardingMessage(true);
      const createdConversationIds = await Promise.all(
        targetUserIds.map(async (targetUserId) => {
          const conversation = await createDirectConversation(targetUserId);
          return conversation.data.id;
        }),
      );

      const uniqueTargetIds = Array.from(
        new Set(
          [...targetConversationIds, ...createdConversationIds].filter(
            (id) => id && id !== activeConversationId,
          ),
        ),
      );

      if (uniqueTargetIds.length === 0) {
        setBannerMessage(
          language === "vi"
            ? "Khong co doi tuong hop le de chuyen tiep"
            : "No valid target to forward",
        );
        return;
      }

      const forwardOne = async (targetConversationId: string) => {
        await forwardMessage(
          activeConversationId,
          forwardMessageId,
          targetConversationId,
        );
        return { targetConversationId, channel: "rest" as const };
      };

      const results = await Promise.allSettled(
        uniqueTargetIds.map((targetId) => forwardOne(targetId)),
      );

      const successItems = results.filter(
        (item) => item.status === "fulfilled",
      ) as PromiseFulfilledResult<{
        targetConversationId: string;
        channel: "rest";
      }>[];
      const failedItems = results.filter(
        (item) => item.status === "rejected",
      ) as PromiseRejectedResult[];
      const successCount = successItems.length;
      const failedCount = failedItems.length;
      const restCount = successItems.length;

      if (successCount > 0) {
        await fetchConversations();
        // Move user to first selected target so forwarded message is visible immediately.
        const primaryTargetId =
          successItems[0]?.value.targetConversationId ?? null;
        hasUserOpenedConversationRef.current = true;
        manuallyOpenedConversationIdRef.current = primaryTargetId;
        pendingReadSyncOnOpenRef.current = true;
        setActiveConversationId(primaryTargetId);
        if (primaryTargetId) {
          void reloadConversationMessagesWithRetry(primaryTargetId, 4);
          // Clear unread when opening forwarded conversation target
          const targetConversation = useChatStore
            .getState()
            .conversations.find((c) => c.id === primaryTargetId);
          if (targetConversation && (targetConversation.unreadCount ?? 0) > 0) {
            markConversationReadLocal(primaryTargetId);
            void markConversationRead(primaryTargetId).catch(() => { });
          }
        }
      }

      if (failedCount === 0 && restCount === 0) {
        setBannerMessage(
          language === "vi"
            ? `Da chuyen tiep den ${successCount} doi tuong`
            : `Forwarded to ${successCount} target(s)`,
        );
      } else if (failedCount === 0 && restCount > 0) {
        setBannerMessage(
          language === "vi"
            ? `Da chuyen tiep ${successCount} doi tuong (${restCount} qua API)`
            : `Forwarded ${successCount} target(s) (${restCount} via API)`,
        );
      } else {
        const firstError = failedItems[0]?.reason;
        const firstErrorMessage = toApiErrorMessage(firstError);
        setBannerMessage(
          language === "vi"
            ? `Chuyen tiep thanh cong ${successCount}, that bai ${failedCount}. Loi: ${firstErrorMessage}`
            : `Forward success ${successCount}, failed ${failedCount}. Error: ${firstErrorMessage}`,
        );
      }

      setIsForwardModalOpen(false);
      setForwardMessageId(null);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsForwardingMessage(false);
    }
  };

  const onReactMessage = async (messageId: string, emoji: string) => {
    if (!activeConversationId || !myUserIdRef.current) {
      return;
    }

    const key = `${myUserIdRef.current}|${emoji}`;
    const current = messages.find((item) => item.id === messageId);
    const hasReaction = Boolean(current?.reactions?.includes(key));

    try {
      if (hasReaction) {
        await removeReaction(activeConversationId, messageId, emoji);
      } else {
        await addReaction(activeConversationId, messageId, emoji);
      }

      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== messageId) {
            return item;
          }
          const reactions = item.reactions ?? [];
          const filtered = reactions.filter(
            (value) => !value.startsWith(`${myUserIdRef.current}|`),
          );
          return {
            ...item,
            reactions: hasReaction ? filtered : [...filtered, key],
          };
        }),
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onSearchFriendByEmail = async () => {
    const email = friendEmail.trim();
    if (!email) return;

    try {
      setIsSearchingFriend(true);
      setFriendProfile(null);
      setFriendshipStatus("NONE");
      const profileResult = await searchUserByEmail(email);
      setFriendProfile(profileResult.data);

      const statusResult = await getFriendshipStatus(profileResult.data.id);
      setFriendshipStatus(normalizeFriendshipStatus(statusResult.data.status));
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSearchingFriend(false);
    }
  };

  const onAddFriend = async () => {
    if (!friendProfile) return;

    try {
      setIsSubmittingFriend(true);
      const result = await addFriend(friendProfile.id);
      setFriendshipStatus(normalizeFriendshipStatus(result.data.status));
      await fetchFriendshipData();
      setBannerMessage(
        language === "vi" ? "Da gui loi moi ket ban" : "Friend request sent",
      );
      setIsAddFriendOpen(false);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSubmittingFriend(false);
    }
  };

  const onCreateGroup = async ({
    name,
    memberIds,
  }: {
    name: string;
    memberIds: string[];
  }) => {
    try {
      setIsCreatingGroup(true);
      const response = await createGroupConversation(name, memberIds);
      const createdConversationId = response.data.id;
      await fetchConversations();
      hasUserOpenedConversationRef.current = true;
      manuallyOpenedConversationIdRef.current = createdConversationId;
      pendingReadSyncOnOpenRef.current = true;
      setActiveConversationId(createdConversationId);
      setActiveTab("messages");
      setBannerMessage(
        language === "vi" ? "Da tao nhom thanh cong" : "Group created successfully",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const canAddFriend =
    Boolean(friendProfile) &&
    friendshipStatus !== "PENDING" &&
    friendshipStatus !== "ACCEPTED";

  const onAcceptFriendRequest = async (friendshipId: string) => {
    try {
      setProcessingFriendshipId(friendshipId);
      await acceptFriendRequest(friendshipId);
      await fetchFriendshipData();
      await fetchConversations();

      const accepted = pendingFriendRequests.find(
        (item) => item.friendshipId === friendshipId,
      );
      if (accepted?.requesterId) {
        const conversation = await createDirectConversation(
          accepted.requesterId,
        );
        await fetchConversations();
        hasUserOpenedConversationRef.current = true;
        manuallyOpenedConversationIdRef.current = conversation.data.id;
        pendingReadSyncOnOpenRef.current = true;
        setActiveConversationId(conversation.data.id);
      }

      setBannerMessage(
        language === "vi"
          ? "Da chap nhan loi moi ket ban"
          : "Friend request accepted",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setProcessingFriendshipId(null);
    }
  };

  const onDeclineFriendRequest = async (friendshipId: string) => {
    try {
      setProcessingFriendshipId(friendshipId);
      await declineFriendRequest(friendshipId);
      await fetchFriendshipData();
      setBannerMessage(
        language === "vi" ? "Da tu choi loi moi" : "Friend request declined",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setProcessingFriendshipId(null);
    }
  };

  const onRemoveFriend = async (friendshipId: string) => {
    try {
      setProcessingFriendshipId(friendshipId);
      const removedContact = friendContacts.find(
        (item) => item.friendshipId === friendshipId,
      );
      await removeFriend(friendshipId);
      if (removedContact && friendProfile?.id === removedContact.userId) {
        setFriendshipStatus("NONE");
      }
      await fetchFriendshipData();
      setBannerMessage(language === "vi" ? "Da xoa ban" : "Friend removed");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setProcessingFriendshipId(null);
    }
  };

  const onOpenFriendConversation = async (friendUserId: string) => {
    try {
      const conversation = await createDirectConversation(friendUserId);
      await fetchConversations();
      hasUserOpenedConversationRef.current = true;
      manuallyOpenedConversationIdRef.current = conversation.data.id;
      pendingReadSyncOnOpenRef.current = true;
      setActiveConversationId(conversation.data.id);
      setActiveTab("messages");

      // Clear unread immediately when opening friend conversation
      const currentConversation = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversation.data.id);
      if (currentConversation && (currentConversation.unreadCount ?? 0) > 0) {
        markConversationReadLocal(conversation.data.id);
        void markConversationRead(conversation.data.id).catch(() => {
          // Silently handle - local state is already cleared
        });
      }
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onSearchUserForForward = async (email: string) => {
    try {
      const profileResult = await searchUserByEmail(email.trim());
      if (!profileResult?.data?.id) {
        return null;
      }
      return profileResult.data;
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return null;
    }
  };

  const onSaveProfile = async () => {
    if (!profileFullName.trim()) {
      setBannerMessage(
        language === "vi"
          ? "Ho ten khong duoc de trong"
          : "Full name is required",
      );
      return;
    }

    try {
      setIsSavingProfile(true);
      const result = await updateMyProfile({
        fullName: profileFullName.trim(),
        phone: profilePhone.trim() || null,
        avatarUrl: profileAvatarUrl.trim() || null,
        gender: profileGender.trim() || null,
        birthdate: profileBirthdate.trim() || null,
      });
      setMyProfile(result.data);
      setBannerMessage(
        language === "vi" ? "Da cap nhat thong tin" : "Profile updated",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onSelectProfileAvatar = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setBannerMessage(
        language === "vi"
          ? "Vui long chon file hinh anh"
          : "Please choose an image file",
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setBannerMessage(
        language === "vi"
          ? "Anh dai dien vuot qua 5MB"
          : "Avatar image exceeds 5MB",
      );
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const uploaded = await uploadMedia(file);

      const uploadedAvatarUrl = uploaded.data.fileUrl;
      setProfileAvatarUrl(uploadedAvatarUrl);

      const updatedProfile = await updateMyProfile({
        fullName: profileFullName.trim() || myProfile?.fullName || "User",
        phone: profilePhone.trim() || null,
        avatarUrl: uploadedAvatarUrl,
        gender: profileGender.trim() || null,
        birthdate: profileBirthdate.trim() || null,
      });
      setMyProfile(updatedProfile.data);
      setBannerMessage(
        language === "vi" ? "Da cap nhat anh dai dien" : "Avatar updated",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onDeleteProfile = async () => {
    const confirmed = window.confirm(
      language === "vi"
        ? "Ban chac chan muon xoa tai khoan?"
        : "Are you sure you want to delete this account?",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingProfile(true);
      await deleteMyProfile();
      clearAuthTokens();
      window.location.replace("/login");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const reloadConversationMessagesWithRetry = async (
    conversationId: string,
    attempts = 4,
  ) => {
    for (let index = 0; index < attempts; index += 1) {
      try {
        const result = await getMessages(conversationId, {
          cursor: null,
          limit: 50,
        });
        if (activeConversationIdRef.current === conversationId) {
          const items = result.data?.items ?? [];
          setMessages(items.slice().reverse());
          setNextCursor(result.data?.nextCursor ?? null);
        }
        return;
      } catch {
        if (index === attempts - 1) {
          return;
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 350);
        });
      }
    }
  };

  const contactUsers = useMemo(() => {
    return friendContacts
      .map((friend, index) => {
        const presence = getPresenceForUser(friend.userId);
        return {
          id: friend.userId,
          friendshipId: friend.friendshipId,
          name:
            userProfileMap[friend.userId]?.fullName ??
            `User ${friend.userId.slice(0, 8)}`,
          email: userProfileMap[friend.userId]?.email ?? null,
          isOnline: presence?.online ?? false,
          presenceLabel: toPresenceLabel(presence),
          sortKey: `${friend.userId}-${index}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [friendContacts, userProfileMap, userPresenceMap, presenceTick]);

  const unreadFromConversations = conversations.reduce(
    (sum, item) => sum + Math.max(0, item.unreadCount ?? 0),
    0,
  );
  const messageBadge =
    Math.max(totalUnreadCount, unreadFromConversations) > 0
      ? Math.min(Math.max(totalUnreadCount, unreadFromConversations), 99)
      : 0;
  const contactsBadge =
    pendingFriendRequestsUnreadCount > 0
      ? Math.min(pendingFriendRequestsUnreadCount, 99)
      : 0;

  const onChangeTab = (tab: ChatTab) => {
    // ═══════════════════════════════════════════════════════════════════════
    // FIX: Clear selected conversation when switching back to messages tab
    // This ensures:
    // - Leaving contacts/profile tab → returning to messages → Welcome Screen
    // - Not keeping the old conversation selected
    // ═══════════════════════════════════════════════════════════════════════
    if (tab === "messages" && activeTab !== "messages") {
      hasUserOpenedConversationRef.current = false;
      manuallyOpenedConversationIdRef.current = null;
      setActiveConversationId(null);
    }
    setActiveTab(tab);
  };

  const activeConversationPresence = activeConversation && activeConversation.type !== "group"
    ? getPresenceForUser(resolvePeerUserId(activeConversation))
    : undefined;

  const activeConversationForView = activeConversation
    ? {
      ...activeConversation,
      name: getConversationDisplayName(activeConversation),
    }
    : null;

  const activeGroupMembers = activeConversationForView?.type === "group"
    ? activeConversationForView.participants ?? []
    : [];

  const typingDisplayName = typingUserId
    ? userProfileMap[typingUserId]?.fullName ?? typingUserId
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar
        active={activeTab}
        messageBadge={messageBadge}
        contactsBadge={contactsBadge}
        chats={sidebarChats}
        selectedChatId={activeConversationId}
        searchText={searchText}
        onTabChange={onChangeTab}
        onSearchTextChange={setSearchText}
        onSelectChat={(conversationId) => {
          hasUserOpenedConversationRef.current = true;
          manuallyOpenedConversationIdRef.current = conversationId;
          pendingReadSyncOnOpenRef.current = true;
          setActiveConversationId(conversationId);

          // ═══════════════════════════════════════════════════════════════════════
          // FIX: Clear unread IMMEDIATELY when user clicks on a conversation
          // This ensures the UI updates instantly without waiting for messages to load
          // The API call syncs with backend; realtime will notify other tabs
          // ═══════════════════════════════════════════════════════════════════════
          const currentConversation = useChatStore
            .getState()
            .conversations.find((c) => c.id === conversationId);
          if (currentConversation && (currentConversation.unreadCount ?? 0) > 0) {
            // 1. Clear unread locally (synchronous - UI updates immediately)
            markConversationReadLocal(conversationId);
            // 2. Sync with backend (async - don't block the click)
            void markConversationRead(conversationId).catch(() => {
              // Silently handle - local state is already cleared, backend will sync on next refresh
            });
          }
        }}
        onCreateChat={() => setIsCreateGroupOpen(true)}
      />

      {activeTab !== "messages" && (
        <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-white">
          {activeTab === "contacts" && (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-800">
                  {language === "vi" ? "Loi moi ket ban" : "Friend Requests"}
                </h2>
              </div>

              <div className="space-y-2 border-b border-slate-200 p-3">
                {pendingFriendRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                    {language === "vi"
                      ? "Chua co loi moi. Dung nut Them ban de tim theo email."
                      : "No pending request. Use New Message to search by email."}
                  </div>
                ) : (
                  pendingFriendRequests.map((request) => {
                    const profile = userProfileMap[request.requesterId];
                    const displayName =
                      profile?.fullName ??
                      `User ${request.requesterId.slice(0, 8)}`;
                    const displayEmail = profile?.email ?? request.requesterId;

                    return (
                      <div
                        key={request.friendshipId}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {initials(displayName)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {displayEmail}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={
                              processingFriendshipId === request.friendshipId
                            }
                            onClick={() =>
                              void onAcceptFriendRequest(request.friendshipId)
                            }
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {language === "vi" ? "Chap nhan" : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              processingFriendshipId === request.friendshipId
                            }
                            onClick={() =>
                              void onDeclineFriendRequest(request.friendshipId)
                            }
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {language === "vi" ? "Tu choi" : "Decline"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 pb-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  {language === "vi" ? "Tat ca ban be" : "All Friends"}
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {contactUsers.map((user) => (
                  <div
                    key={user.sortKey}
                    className="mb-1 flex cursor-pointer items-center justify-between rounded-xl p-3 transition-all duration-200 hover:bg-slate-50"
                    onClick={() => void onOpenFriendConversation(user.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                        {initials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700">
                          {user.name}
                        </p>
                        <p
                          className={`text-[11px] ${user.isOnline ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          {user.presenceLabel}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="max-w-25 truncate text-xs text-slate-400">
                        {user.email ?? ""}
                      </span>
                      <button
                        type="button"
                        disabled={processingFriendshipId === user.friendshipId}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onRemoveFriend(user.friendshipId);
                        }}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {language === "vi" ? "Xoa" : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
                {contactUsers.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                    {language === "vi" ? "Chua co ban be" : "No friends yet"}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt="avatar"
                    className="mb-3 h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {initials(myProfile?.fullName ?? "User")}
                  </div>
                )}
                <h2 className="text-base font-semibold text-slate-800">
                  {myProfile?.fullName ?? "User"}
                </h2>
                <p className="text-xs text-slate-500">
                  {myProfile?.email ?? "-"}
                </p>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi" ? "Email" : "Email"}
                  <input
                    type="text"
                    value={myProfile?.email ?? ""}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi" ? "Ho ten" : "Full name"}
                  <input
                    type="text"
                    value={profileFullName}
                    onChange={(event) => setProfileFullName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi" ? "So dien thoai" : "Phone"}
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(event) => setProfilePhone(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi"
                    ? "Avatar (upload S3)"
                    : "Avatar (upload S3)"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void onSelectProfileAvatar(
                        event.target.files?.[0] ?? null,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {profileAvatarUrl && (
                    <a
                      href={profileAvatarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-[11px] font-normal text-indigo-600 hover:text-indigo-700"
                    >
                      {profileAvatarUrl}
                    </a>
                  )}
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi" ? "Gioi tinh" : "Gender"}
                  <select
                    value={profileGender}
                    onChange={(event) => setProfileGender(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="">
                      {language === "vi" ? "Khong chon" : "Not set"}
                    </option>
                    <option value="MALE">
                      {language === "vi" ? "Nam" : "Male"}
                    </option>
                    <option value="FEMALE">
                      {language === "vi" ? "Nu" : "Female"}
                    </option>
                    <option value="OTHER">
                      {language === "vi" ? "Khac" : "Other"}
                    </option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                  {language === "vi" ? "Ngay sinh" : "Birthdate"}
                  <input
                    type="date"
                    value={profileBirthdate}
                    onChange={(event) =>
                      setProfileBirthdate(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void onSaveProfile()}
                    disabled={isSavingProfile || isUploadingAvatar}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isUploadingAvatar
                      ? language === "vi"
                        ? "Dang tai anh..."
                        : "Uploading avatar..."
                      : isSavingProfile
                        ? language === "vi"
                          ? "Dang luu..."
                          : "Saving..."
                        : language === "vi"
                          ? "Luu thong tin"
                          : "Save profile"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void onDeleteProfile()}
                    disabled={isDeletingProfile}
                    className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
                  >
                    {isDeletingProfile
                      ? language === "vi"
                        ? "Dang xoa..."
                        : "Deleting..."
                      : language === "vi"
                        ? "Xoa tai khoan"
                        : "Delete account"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "calls" && (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {language === "vi" ? "Cuoc goi" : "Calls"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {language === "vi"
                    ? "Muc calls se duoc mo rong o buoc tiep theo."
                    : "Calls section will be expanded in the next step."}
                </p>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800">
                  {language === "vi" ? "Cai dat" : "Settings"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {language === "vi"
                    ? "Tuy chinh tai khoan va ung dung"
                    : "Customize account and app preferences"}
                </p>
              </div>
              <div className="mt-4">
                <Link
                  to="/login"
                  onClick={() => clearAuthTokens()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
                >
                  <LogOut size={16} />
                  <span>{language === "vi" ? "Dang xuat" : "Logout"}</span>
                </Link>
              </div>
            </div>
          )}
        </aside>
      )}

      <main className="min-w-0 flex-1 bg-slate-50">
        {activeTab === "messages" ? (
          <section className="relative flex h-full flex-col overflow-hidden">
            {activeConversationForView?.type === "group" ? (
              <GroupChat
                language={language}
                conversation={activeConversationForView}
                members={activeGroupMembers}
                userProfileMap={userProfileMap}
              >
                <Chat
                  language={language}
                  activeConversation={activeConversationForView}
                  activeConversationOnline={false}
                  activeConversationPresenceLabel={`${activeGroupMembers.length} ${language === "vi" ? "thanh vien" : "members"}`}
                  messages={messages}
                  myProfile={myProfile}
                  isLoadingMessages={isLoadingMessages}
                  draftMessage={draftMessage}
                  onDraftChange={(value) => {
                    setDraftMessage(value);
                    onTypingTextChange(value);
                  }}
                  onSendMessage={onSendMessage}
                  onSendFiles={onSendFiles}
                  onEditMessage={onEditMessage}
                  onRecallMessage={onRecallMessage}
                  onDeleteForMe={onDeleteForMe}
                  onForwardMessage={onForwardMessage}
                  onReactMessage={onReactMessage}
                  pendingUploads={pendingUploads}
                  onRetryUpload={onRetryUpload}
                  onCancelUpload={onCancelUpload}
                  isSending={isSending}
                  typingText={typingDisplayName ? `${typingDisplayName} ${language === "vi" ? "dang go..." : "is typing..."}` : null}
                  hasMoreMessages={Boolean(nextCursor)}
                  isLoadingMoreMessages={isLoadingMoreMessages}
                  onLoadOlderMessages={onLoadOlderMessages}
                  onViewportBottomChange={setIsChatViewportAtBottom}
                />
              </GroupChat>
            ) : (
              <Chat
                language={language}
                activeConversation={activeConversationForView}
                activeConversationOnline={
                  activeConversationPresence?.online ?? false
                }
                activeConversationPresenceLabel={toPresenceLabel(
                  activeConversationPresence,
                )}
                messages={messages}
                myProfile={myProfile}
                isLoadingMessages={isLoadingMessages}
                draftMessage={draftMessage}
                onDraftChange={(value) => {
                  setDraftMessage(value);
                  // Use debounced typing indicator
                  onTypingTextChange(value);
                }}
                onSendMessage={onSendMessage}
                onSendFiles={onSendFiles}
                onEditMessage={onEditMessage}
                onRecallMessage={onRecallMessage}
                onDeleteForMe={onDeleteForMe}
                onForwardMessage={onForwardMessage}
                onReactMessage={onReactMessage}
                pendingUploads={pendingUploads}
                onRetryUpload={onRetryUpload}
                onCancelUpload={onCancelUpload}
                isSending={isSending}
                typingText={typingDisplayName ? `${typingDisplayName} ${language === "vi" ? "dang go..." : "is typing..."}` : null}
                hasMoreMessages={Boolean(nextCursor)}
                isLoadingMoreMessages={isLoadingMoreMessages}
                onLoadOlderMessages={onLoadOlderMessages}
                onViewportBottomChange={setIsChatViewportAtBottom}
              />
            )}
          </section>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">
                {language === "vi"
                  ? "Chon tab Messages"
                  : "Select Messages tab"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {language === "vi"
                  ? "Chuyen ve tab Messages de bat dau nhan tin real-time."
                  : "Switch back to Messages tab to start real-time chat."}
              </p>
            </div>
          </div>
        )}
      </main>

      <AddFriendModal
        language={language}
        open={isAddFriendOpen}
        friendEmail={friendEmail}
        onFriendEmailChange={setFriendEmail}
        onClose={() => {
          setIsAddFriendOpen(false);
          setFriendEmail("");
          setFriendProfile(null);
          setFriendshipStatus("NONE");
        }}
        onSearch={onSearchFriendByEmail}
        onAddFriend={onAddFriend}
        isSearchingFriend={isSearchingFriend}
        isSubmittingFriend={isSubmittingFriend}
        friendProfile={friendProfile}
        friendshipStatus={friendshipStatus}
        canAddFriend={canAddFriend}
      />

      <CreateGroupModal
        language={language}
        open={isCreateGroupOpen}
        contacts={friendContacts}
        userProfileMap={userProfileMap}
        isSubmitting={isCreatingGroup}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreate={({ name, memberIds }: { name: string; memberIds: string[] }) =>
          onCreateGroup({ name, memberIds })
        }
      />

      <ForwardMessageModal
        open={isForwardModalOpen}
        language={language}
        conversations={conversations}
        activeConversationId={activeConversationId}
        isSubmitting={isForwardingMessage}
        onSearchUserByEmail={onSearchUserForForward}
        onClose={() => {
          setIsForwardModalOpen(false);
          setForwardMessageId(null);
        }}
        onConfirm={onConfirmForwardTargets}
      />

      {bannerMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-slate-700 shadow-lg">
          {bannerMessage}
        </div>
      )}

      {uploadLimitModalMessage && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              {language === "vi" ? "Vuot gioi han dung luong" : "File size limit exceeded"}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {uploadLimitModalMessage}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setUploadLimitModalMessage(null)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
