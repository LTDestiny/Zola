import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, LogOut, Settings, Shield } from "lucide-react";
import {
  acceptFriendRequest,
  addReaction,
  addFriend,
  createDirectConversation,
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
  getUserSummary,
  markConversationRead,
  removeFriend,
  readMessage,
  recallMessage,
  removeReaction,
  searchUserByEmail,
  sendMessage,
  toApiErrorMessage,
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
} from "../api/chatRealtime";
import { clearAuthTokens, getAccessToken, getSessionId } from "../auth/token";
import { useLanguage } from "../i18n/language";
import { Chat } from "./chat";
import { AddFriendModal } from "./components/AddFriendModal";
import { ForwardMessageModal } from "./components/ForwardMessageModal";
import { Sidebar } from "./components/Sidebar";
import type { ChatListItem } from "./components/ChatList";
import type { MiniNavTab } from "./components/MiniNav";
import { useChatStore } from "../stores/chatStore";

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

  const [draftMessage, setDraftMessage] = useState("");

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState("NONE");
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);
  const [isSubmittingFriend, setIsSubmittingFriend] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    PendingFriendRequestItem[]
  >([]);
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

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;

  const realtimeClientRef = useRef<ChatRealtimeClient | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const refreshConversationsTimeoutRef = useRef<number | null>(null);
  const isSilentRefreshingRef = useRef(false);
  const conversationIdsRef = useRef<string[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const processedRealtimeMessageIdsRef = useRef<Set<string>>(new Set());
  const uploadAbortControllersRef = useRef<Record<string, AbortController>>({});
  const uploadFileRegistryRef = useRef<Record<string, { file: File; caption: string; conversationId: string }>>({});

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    conversationIdsRef.current = conversations.map((conversation) => conversation.id);
  }, [conversations]);

  useEffect(() => {
    myUserIdRef.current = myProfile?.id ?? null;
  }, [myProfile?.id]);

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
      return (
        conversation.name.toLowerCase().includes(normalized) ||
        conversation.lastMessage.toLowerCase().includes(normalized)
      );
    });
  }, [conversations, searchText]);

  const sidebarChats = useMemo<ChatListItem[]>(() => {
    return filteredConversations.map((conversation) => ({
      id: conversation.id,
      name: conversation.name,
      avatar: initials(conversation.name),
      timestamp: conversation.lastMessageAt
        ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(conversation.lastMessageAt))
        : "--:--",
      lastMessage: conversation.lastMessage || "...",
      unreadCount: conversation.unreadCount ?? 0,
      isOnline: true,
    }));
  }, [filteredConversations, language]);

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
      const items = result.data ?? [];
      setConversationList(items);
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
      const [pendingResult, friendsResult] = await Promise.all([
        getPendingFriendRequests(),
        getFriends(),
      ]);

      const pending = pendingResult.data ?? [];
      const friends = friendsResult.data ?? [];
      setPendingFriendRequests(pending);
      setFriendContacts(friends);

      const ids = Array.from(
        new Set([
          ...pending.map((item) => item.requesterId),
          ...friends.map((item) => item.userId),
        ]),
      );

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
      setUserProfileMap(profileMap);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  useEffect(() => {
    void fetchConversations();
    void fetchFriendshipData();
  }, []);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      void fetchConversations({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, []);

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
        if (event.eventType === "TYPING") {
          if (event.actorId !== myUserIdRef.current) {
            setTypingUserId(event.typing ? event.actorId : null);
          }
          return;
        }

        if (
          event.eventType === "CONVERSATION_UPDATED" ||
          event.eventType === "UNREAD_COUNT_UPDATED" ||
          event.eventType === "TOTAL_UNREAD_UPDATED" ||
          event.eventType === "NEW_MESSAGE" ||
          event.eventType === "MESSAGE_SENT"
        ) {
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

        const messageKey = `${event.eventType}:${payload.messageId}`;
        if (event.eventType === "NEW_MESSAGE") {
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
          reactions: payload.reactions,
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

        if (event.conversationId === activeConversationIdRef.current) {
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
            (event.eventType === "MESSAGE_SENT" || event.eventType === "NEW_MESSAGE") &&
            normalizedMessage.senderId !== myUserIdRef.current
          ) {
            const canAutoRead =
              activeTab === "messages" &&
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
        const isDifferentConversation =
          event.conversationId !== activeConversationIdRef.current;
        const shouldLocalIncrementUnread =
          unreadPatch === undefined &&
          isIncomingFromOtherUser &&
          isDifferentConversation &&
          (event.eventType === "NEW_MESSAGE" || event.eventType === "MESSAGE_SENT");

        if (shouldLocalIncrementUnread) {
          const currentConversation = useChatStore
            .getState()
            .conversations.find((item) => item.id === event.conversationId);
          unreadPatch = (currentConversation?.unreadCount ?? 0) + 1;
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
      setMessages([]);
      setNextCursor(null);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const result = await getMessages(activeConversationId, {
          cursor: null,
          limit: 50,
        });
        const items = result.data?.items ?? [];
        setMessages(items.slice().reverse());
        setNextCursor(result.data?.nextCursor ?? null);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      } finally {
        setIsLoadingMessages(false);
      }
    };

    void loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const isViewingMessages =
      activeTab === "messages" &&
      document.visibilityState === "visible" &&
      document.hasFocus();
    if (!isViewingMessages) {
      return;
    }

    const latestMessageId = messages[messages.length - 1]?.id;
    markConversationReadLocal(activeConversationId);
    if (!latestMessageId) {
      return;
    }
    void markConversationRead(activeConversationId, latestMessageId).catch(() => {
      // Keep UI responsive even if API gateway lags behind deployment.
    });
  }, [activeConversationId, activeTab, messages, markConversationReadLocal]);

  useEffect(() => {
    const syncReadWhenFocused = () => {
      if (!activeConversationIdRef.current) {
        return;
      }
      const isViewingMessages =
        activeTab === "messages" &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (!isViewingMessages) {
        return;
      }
      const latestMessageId = messages[messages.length - 1]?.id;
      markConversationReadLocal(activeConversationIdRef.current);
      if (!latestMessageId) {
        return;
      }
      void markConversationRead(activeConversationIdRef.current, latestMessageId).catch(() => {
        // Ignore read sync errors to avoid breaking incoming message flow.
      });
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

    try {
      setIsLoadingMoreMessages(true);
      const result = await getMessages(activeConversationId, {
        cursor: nextCursor,
        limit: 50,
      });
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

  const onSendMessage = async () => {
    const content = draftMessage.trim();
    if (!content || !activeConversationId || isSending) return;

    try {
      setIsSending(true);
      const result = await sendMessage(activeConversationId, content, {
        type: "TEXT",
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
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { ...item, recalled: true, content: "This message was recalled" }
            : item,
        ),
      );
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
        setActiveConversationId(primaryTargetId);
        if (primaryTargetId) {
          void reloadConversationMessagesWithRetry(primaryTargetId, 4);
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
      setFriendshipStatus(statusResult.data.status);
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
      setFriendshipStatus(result.data.status);
      const conversationResult = await createDirectConversation(
        friendProfile.id,
      );
      await fetchConversations();
      await fetchFriendshipData();
      setActiveConversationId(conversationResult.data.id);
      setBannerMessage(
        language === "vi" ? "Da tao hoi thoai" : "Conversation created",
      );
      setIsAddFriendOpen(false);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSubmittingFriend(false);
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

      const accepted = pendingFriendRequests.find(
        (item) => item.friendshipId === friendshipId,
      );
      if (accepted?.requesterId) {
        const conversation = await createDirectConversation(
          accepted.requesterId,
        );
        await fetchConversations();
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
      await removeFriend(friendshipId);
      await fetchFriendshipData();
      setBannerMessage(language === "vi" ? "Da xoa ban" : "Friend removed");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setProcessingFriendshipId(null);
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
      .map((friend, index) => ({
        id: friend.userId,
        friendshipId: friend.friendshipId,
        name:
          userProfileMap[friend.userId]?.fullName ??
          `User ${friend.userId.slice(0, 8)}`,
        email: userProfileMap[friend.userId]?.email ?? null,
        sortKey: `${friend.userId}-${index}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [friendContacts, userProfileMap]);

  const messageBadge = totalUnreadCount > 0 ? Math.min(totalUnreadCount, 99) : 0;

  const onChangeTab = (tab: ChatTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar
        active={activeTab}
        messageBadge={messageBadge}
        chats={sidebarChats}
        selectedChatId={activeConversationId}
        searchText={searchText}
        onTabChange={onChangeTab}
        onSearchTextChange={setSearchText}
        onSelectChat={(conversationId) => {
          setActiveConversationId(conversationId);
          markConversationReadLocal(conversationId);
        }}
        onCreateChat={() => setIsAddFriendOpen(true)}
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
                    className="mb-1 flex items-center justify-between rounded-xl p-3 transition-all duration-200 hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                        {initials(user.name)}
                      </div>
                      <span className="truncate text-sm text-slate-700">
                        {user.name}
                      </span>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="max-w-25 truncate text-xs text-slate-400">
                        {user.email ?? ""}
                      </span>
                      <button
                        type="button"
                        disabled={processingFriendshipId === user.friendshipId}
                        onClick={() => void onRemoveFriend(user.friendshipId)}
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
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {initials(myProfile?.fullName ?? "User")}
                </div>
                <h2 className="text-base font-semibold text-slate-800">
                  {myProfile?.fullName ?? "User"}
                </h2>
                <p className="text-xs text-slate-500">
                  {myProfile?.email ?? "-"}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
                >
                  <Settings size={16} />
                  <span>
                    {language === "vi"
                      ? "Cai dat tai khoan"
                      : "Account Settings"}
                  </span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
                >
                  <Bell size={16} />
                  <span>
                    {language === "vi" ? "Thong bao" : "Notifications"}
                  </span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
                >
                  <Shield size={16} />
                  <span>{language === "vi" ? "Bao mat" : "Privacy"}</span>
                </button>
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
            <Chat
              language={language}
              activeConversation={activeConversation}
              messages={messages}
              myProfile={myProfile}
              isLoadingMessages={isLoadingMessages}
              draftMessage={draftMessage}
              onDraftChange={(value) => {
                setDraftMessage(value);
                const client = realtimeClientRef.current;
                if (!activeConversationId || !client || !client.isConnected()) {
                  return;
                }

                client.publishTyping(activeConversationId, true);
                if (typingTimeoutRef.current) {
                  window.clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = window.setTimeout(() => {
                  client.publishTyping(activeConversationId, false);
                  typingTimeoutRef.current = null;
                }, 1200);
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
              typingText={typingUserId ? `${typingUserId} is typing...` : null}
              hasMoreMessages={Boolean(nextCursor)}
              isLoadingMoreMessages={isLoadingMoreMessages}
              onLoadOlderMessages={onLoadOlderMessages}
            />
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
