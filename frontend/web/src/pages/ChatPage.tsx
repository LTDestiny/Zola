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
  forwardMessage,
  getConversations,
  getFriends,
  getFriendshipStatus,
  getMessages,
  getMyProfile,
  getPendingFriendRequests,
  getUserSummary,
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

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type ChatTab = MiniNavTab;

export function ChatPage() {
  const { language } = useLanguage();

  const [searchText, setSearchText] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
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

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [draftMessage, setDraftMessage] = useState("");

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
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

  const [bannerMessage, setBannerMessage] = useState("");
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("messages");

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;

  const realtimeClientRef = useRef<ChatRealtimeClient | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

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
      unreadCount: 0,
      isOnline: true,
    }));
  }, [filteredConversations, language]);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const result = await getConversations();
      const items = result.data ?? [];
      setConversations(items);

      if (!activeConversationId && items.length > 0) {
        setActiveConversationId(items[0].id);
      } else if (
        activeConversationId &&
        !items.some((conversation) => conversation.id === activeConversationId)
      ) {
        setActiveConversationId(items[0]?.id ?? null);
      }
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
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
        if (activeConversationIdRef.current) {
          client.subscribeConversation(activeConversationIdRef.current);
        }
      },
      onDisconnect: () => {
        setIsRealtimeConnected(false);
      },
      onError: (message) => {
        setBannerMessage(message);
      },
      onEvent: (event: ChatRealtimeEvent) => {
        if (event.eventType === "TYPING") {
          if (event.actorId !== myUserIdRef.current) {
            setTypingUserId(event.typing ? event.actorId : null);
          }
          return;
        }

        const payload = event.message;
        if (!payload) {
          return;
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
          deletedForUsers: payload.deletedForUsers,
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
            const exists = prev.some(
              (item) => item.id === normalizedMessage.id,
            );
            if (exists) {
              return prev.map((item) =>
                item.id === normalizedMessage.id ? normalizedMessage : item,
              );
            }
            return [...prev, normalizedMessage];
          });

          if (
            event.eventType === "MESSAGE_SENT" &&
            normalizedMessage.senderId !== myUserIdRef.current
          ) {
            void markMessageAsRead(event.conversationId, normalizedMessage.id);
          }
        }

        setConversations((prev) =>
          prev.map((conversation) => {
            if (conversation.id !== event.conversationId) {
              return conversation;
            }
            return {
              ...conversation,
              lastMessage: normalizedMessage.content,
              lastMessageAt: normalizedMessage.createdAt,
            };
          }),
        );
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
      realtimeClientRef.current?.disconnect();
      realtimeClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setTypingUserId(null);
      return;
    }

    const client = realtimeClientRef.current;
    if (client && client.isConnected()) {
      client.subscribeConversation(activeConversationId);
    }
  }, [activeConversationId, isRealtimeConnected]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const result = await getMessages(activeConversationId, {
          page: 0,
          size: 100,
        });
        setMessages(result.data ?? []);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      } finally {
        setIsLoadingMessages(false);
      }
    };

    void loadMessages();
  }, [activeConversationId]);

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

  const onSendFile = async (file: File) => {
    if (!activeConversationId || isSending) return;

    try {
      setIsSending(true);

      const typeByMime = file.type.startsWith("image/")
        ? "IMAGE"
        : file.type.startsWith("video/")
          ? "VIDEO"
          : "FILE";

      const sizeLimit =
        typeByMime === "IMAGE"
          ? MAX_IMAGE_BYTES
          : typeByMime === "VIDEO"
            ? MAX_VIDEO_BYTES
            : MAX_FILE_BYTES;

      if (file.size > sizeLimit) {
        const mb = Math.round((sizeLimit / (1024 * 1024)) * 10) / 10;
        setBannerMessage(
          language === "vi"
            ? `File vuot gioi han dung luong (${mb} MB)`
            : `File exceeds size limit (${mb} MB)`,
        );
        return;
      }

      const uploaded = await uploadMedia(file);
      const content = `📎 ${uploaded.data.fileName}`;
      const result = await sendMessage(activeConversationId, content, {
        type: typeByMime,
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
      setBannerMessage(
        language === "vi"
          ? `Da gui ${typeByMime.toLowerCase()}: ${uploaded.data.fileName}`
          : `${typeByMime.toLowerCase()} sent: ${uploaded.data.fileName}`,
      );
      await fetchConversations();
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const onRecallMessage = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      const realtimeSent = Boolean(
        realtimeClientRef.current?.publishRecall(
          activeConversationId,
          messageId,
        ),
      );

      if (realtimeSent) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  recalled: true,
                  content: "This message was recalled",
                }
              : item,
          ),
        );
        return;
      }

      await recallMessage(activeConversationId, messageId);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { ...item, recalled: true, content: "This message was recalled" }
            : item,
        ),
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
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
          page: 0,
          size: 100,
        });
        if (activeConversationIdRef.current === conversationId) {
          setMessages(result.data ?? []);
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

  const messageBadge =
    conversations.length > 0 ? Math.min(conversations.length, 9) : 0;

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
        onSelectChat={setActiveConversationId}
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
                      <span className="max-w-[100px] truncate text-xs text-slate-400">
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
              onSendFile={onSendFile}
              onRecallMessage={onRecallMessage}
              onDeleteForMe={onDeleteForMe}
              onForwardMessage={onForwardMessage}
              onReactMessage={onReactMessage}
              isSending={isSending}
              typingText={typingUserId ? `${typingUserId} is typing...` : null}
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
    </div>
  );
}
