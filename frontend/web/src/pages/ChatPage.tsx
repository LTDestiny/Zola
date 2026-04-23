import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogOut } from "lucide-react";
import {
  acceptFriendRequest,
  addReaction,
  addGroupMember,
  addFriend,
  approveGroupMember,
  createDirectConversation,
  createGroupConversation,
  deleteGroupConversation,
  deleteMyProfile,
  deleteForMe,
  declineFriendRequest,
  editMessage,
  forwardMessage,
  getConversations,
  getFriends,
  getFriendshipStatus,
  getGroupSettings,
  getMessages,
  getMyProfile,
  getPendingFriendRequests,
  getPendingFriendRequestsUnreadCount,
  getUserSummary,
  leaveGroupConversation,
  joinGroupByInviteCode,
  markConversationRead,
  getUsersPresence,
  markPendingFriendRequestsRead,
  removeFriend,
  removeGroupMember,
  readMessage,
  rejectGroupMember,
  recallMessage,
  removeReaction,
  searchUserByEmail,
  sendMessage,
  setGroupAdmin,
  pinGroupMessage,
  toApiErrorMessage,
  unpinGroupMessage,
  updateMyProfile,
  updateGroupSettings,
  type ConversationItem,
  type FriendContactItem,
  type GroupSettings,
  type MessageItem,
  type PendingFriendRequestItem,
  type UserProfile,
} from "../api/chatApi";
import { uploadMedia } from "../api/mediaApi";
import {
  ChatRealtimeClient,
  type CallRealtimeEvent,
  type CallSignalType,
  type ChatRealtimeEvent,
  type PresenceRealtimeEvent,
} from "../api/chatRealtime";
import { clearAuthTokens, getAccessToken, getSessionId } from "../auth/token";
import { useLanguage } from "../i18n/language";
import { Chat } from "./chat";
import { AddFriendModal } from "./components/AddFriendModal";
import { ForwardMessageModal } from "./components/ForwardMessageModal";
import { Sidebar } from "./components/Sidebar";
import {
  InAppCallOverlay,
  type ActiveCallView,
  type InAppCallMode,
  type InAppCallStatus,
  type IncomingCallView,
} from "./components/InAppCallOverlay";
// @ts-expect-error JSX module without TS declarations
import { CreateGroupModal } from "./components/CreateGroupModal.jsx";
// @ts-expect-error JSX module without TS declarations
import { GroupChat } from "./components/GroupChat.jsx";
import type { ChatListItem } from "./components/ChatList";
import type { MiniNavTab } from "./components/MiniNav";
import { useChatStore } from "../stores/chatStore";
import { useTyping } from "../hooks/useTyping";
import { resolveMediaUrl } from "./utils/mediaUrl";
import {
  CallManager,
  type CallLifecycleEvent,
} from "./call/CallManager";

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
      ? "Khong the thu hoi tin nhan sau 5p"
      : "Cannot recall this message after 5 minutes";
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

type QuickCallMode = "voice" | "video";

type QuickCallHistoryItem = {
  id: string;
  conversationId: string;
  conversationName: string;
  mode: QuickCallMode;
  direction: "incoming" | "outgoing";
  status: "started" | "connected" | "ended" | "missed" | "rejected";
  createdAt: string;
};

type DirectCallSession = {
  callId: string;
  conversationId: string;
  conversationType: "private" | "group";
  initiatorUserId: string;
  peerUserId?: string;
  peerDisplayName: string;
  mode: InAppCallMode;
  direction: "incoming" | "outgoing";
  status: InAppCallStatus;
  startedAt: string;
  connectedAt: string | null;
  participantIds: string[];
};

type GroupCallNotice = {
  callId: string;
  conversationId: string;
  initiatorUserId: string;
  initiatorDisplayName: string;
  mode: InAppCallMode;
  createdAt: string;
};

type IncomingCallState = {
  callId: string;
  conversationId: string;
  conversationType: "private" | "group";
  initiatorUserId: string;
  peerUserId: string;
  peerDisplayName: string;
  mode: InAppCallMode;
};

type ParsedCallSignalPayload = {
  reason?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  initiatorUserId?: string;
  conversationType?: "private" | "group";
};

type GroupPreferenceItem = {
  muted: boolean;
  pinned: boolean;
  hidden: boolean;
};

type PinnedBoardItem = {
  id: string;
  itemType: "pin" | "note";
  title: string;
  preview: string;
  sourceMessageId: string;
  createdAtMs: number;
};

type PinBoardEvent = {
  id: string;
  kind: "BOARD_NOTE";
  itemType: "note";
  pinToTop: boolean;
  sourceMessageId: string;
  title: string;
  preview: string;
  createdAtMs: number;
};

type CreateGroupPollInput = {
  question: string;
  options: string[];
  multipleChoice: boolean;
  allowChangeVote: boolean;
  deadlineMinutes: number;
  hideResultsBeforeVote: boolean;
};

const GROUP_PREFERENCE_STORAGE_KEY = "zola_group_preferences_v1";
const HIDDEN_CHAT_PIN_STORAGE_KEY = "zola_hidden_chat_pin_v1";

function parsePinBoardEvent(message: MessageItem): PinBoardEvent | null {
  const rawType = (message.type ?? "TEXT").toUpperCase();
  if (rawType !== "NOTE") {
    return null;
  }

  try {
    const payload = JSON.parse(message.content) as Record<string, unknown>;
    const kind = String(payload?.kind ?? "").toUpperCase();
    if (kind !== "BOARD_NOTE") {
      return null;
    }

    const sourceMessageId = String(payload?.sourceMessageId ?? message.id ?? "").trim();
    if (!sourceMessageId || !message.id) {
      return null;
    }

    const pinToTop = Boolean(payload?.pinToTop);
    const title = String(payload?.title ?? "").trim();
    const preview = String(payload?.preview ?? payload?.note ?? "").trim();
    const createdAtRaw = String(payload?.createdAt ?? message.createdAt ?? "");
    const createdAtMs = Date.parse(createdAtRaw);
    return {
      id: message.id,
      kind: "BOARD_NOTE",
      itemType: "note",
      pinToTop,
      sourceMessageId,
      title: title || "Group note",
      preview,
      createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
    };
  } catch {
    return null;
  }
}

function loadGroupPreferences(): Record<string, GroupPreferenceItem> {
  try {
    const raw = window.localStorage.getItem(GROUP_PREFERENCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, GroupPreferenceItem>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function loadHiddenConversationPin(): string | null {
  try {
    const raw = window.localStorage.getItem(HIDDEN_CHAT_PIN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const normalized = raw.trim();
    return /^\d{4,8}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function persistHiddenConversationPin(pin: string | null) {
  try {
    if (!pin) {
      window.localStorage.removeItem(HIDDEN_CHAT_PIN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(HIDDEN_CHAT_PIN_STORAGE_KEY, pin);
  } catch {
    // Ignore localStorage persistence errors.
  }
}

function isValidConversationPin(pin: string) {
  return /^\d{4,8}$/.test(pin.trim());
}

function inferMediaKind(file: File): "image" | "video" | "file" {
  const mime = (file.type ?? "").toLowerCase();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "avif", "jfif"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
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

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function parseCallSignalPayload(payload: string | null): ParsedCallSignalPayload {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload) as ParsedCallSignalPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

import { env } from "../shared/env";

function loadWebRtcIceServers(): RTCIceServer[] {
  const fallback: RTCIceServer[] = [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ];

  const raw = env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      urls?: string | string[];
      username?: string;
      credential?: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallback;
    }

    const normalized = parsed
      .map((item): RTCIceServer | null => {
        const urls = item?.urls;
        if (!urls) {
          return null;
        }
        if (typeof urls === "string" && !urls.trim()) {
          return null;
        }
        if (Array.isArray(urls) && urls.length === 0) {
          return null;
        }

        const normalizedItem: RTCIceServer = {
          urls,
        };

        if (item.username) {
          normalizedItem.username = item.username;
        }
        if (item.credential) {
          normalizedItem.credential = item.credential;
        }

        return normalizedItem;
      })
      .filter((item): item is RTCIceServer => Boolean(item));

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

const WEBRTC_ICE_SERVERS = loadWebRtcIceServers();
const WEBRTC_FORCE_RELAY =
  String(env.VITE_WEBRTC_FORCE_RELAY ?? "false").toLowerCase() ===
  "true";
const WEBRTC_ICE_POLICY: RTCIceTransportPolicy = WEBRTC_FORCE_RELAY
  ? "relay"
  : "all";
const CALL_CONNECT_TIMEOUT_MS = 30000;
const CALL_INVITE_RETRY_MS = 1800;
const GROUP_CALL_SOLO_TIMEOUT_MS = 30000;
const CALL_DEBUG =
  String(env.VITE_CALL_DEBUG ?? "true").toLowerCase() === "true";

function logCallDebug(stage: string, payload?: unknown) {
  if (!CALL_DEBUG) {
    return;
  }
  if (payload === undefined) {
    console.log(`[call-debug][${stage}]`);
    return;
  }
  console.log(`[call-debug][${stage}]`, payload);
}

type UserPresenceState = {
  online: boolean;
  lastChangedAt: string | null;
};

export function ChatPage() {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchText, setSearchText] = useState("");
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.selectedConversationId);
  const totalUnreadCount = useChatStore((state) => state.totalUnreadCount);
  const setConversationList = useChatStore((state) => state.setConversations);
  const setActiveConversationId = useChatStore((state) => state.setSelectedConversationId);
  const upsertConversation = useChatStore((state) => state.upsertConversation);
  const markConversationReadLocal = useChatStore((state) => state.markConversationRead);
  const syncTotalUnread = useChatStore((state) => state.syncTotalUnread);
  const lastReadSyncedMessageByConversationRef = useRef<Record<string, string>>({});
  const readSyncInFlightRef = useRef<Record<string, string>>({});

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
    const alreadySynced =
      lastReadSyncedMessageByConversationRef.current[conversationId] === messageId;
    const inFlightForSameMessage =
      readSyncInFlightRef.current[conversationId] === messageId;
    if (alreadySynced || inFlightForSameMessage) {
      return;
    }

    readSyncInFlightRef.current[conversationId] = messageId;
    try {
      const realtimeSent = Boolean(
        realtimeClientRef.current?.publishRead(conversationId, messageId),
      );

      if (realtimeSent) {
        lastReadSyncedMessageByConversationRef.current[conversationId] = messageId;
        return;
      }

      try {
        await readMessage(conversationId, messageId);
        lastReadSyncedMessageByConversationRef.current[conversationId] = messageId;
      } catch (error) {
        // Avoid unhandled promise rejection when gateway has stale routes.
        setBannerMessage(toApiErrorMessage(error));
      }
    } finally {
      if (readSyncInFlightRef.current[conversationId] === messageId) {
        delete readSyncInFlightRef.current[conversationId];
      }
    }
  };

  const syncConversationReadState = async (
    conversationId: string,
    messageId: string,
  ) => {
    if (lastReadSyncedMessageByConversationRef.current[conversationId] === messageId) {
      return;
    }

    // Prefer realtime read receipt first so sender sees "seen" immediately.
    await markMessageAsRead(conversationId, messageId);

    if (lastReadSyncedMessageByConversationRef.current[conversationId] !== messageId) {
      return;
    }

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
  const [isAddingGroupMembers, setIsAddingGroupMembers] = useState(false);
  const [isUpdatingGroupProfile, setIsUpdatingGroupProfile] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardMessageIds, setForwardMessageIds] = useState<string[]>([]);
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadItem[]>([]);
  const [callHistory, setCallHistory] = useState<QuickCallHistoryItem[]>([]);
  const [activeCall, setActiveCall] = useState<DirectCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [groupCallNoticeMap, setGroupCallNoticeMap] = useState<Record<string, GroupCallNotice>>({});
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStreams, setRemoteCallStreams] = useState<Record<string, MediaStream>>({});
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [hiddenConversationPin, setHiddenConversationPin] = useState<string | null>(
    () => loadHiddenConversationPin(),
  );
  const [settingsPinDraft, setSettingsPinDraft] = useState("");
  const [settingsPinConfirmDraft, setSettingsPinConfirmDraft] = useState("");
  const [uploadLimitModalMessage, setUploadLimitModalMessage] = useState<string | null>(null);
  const [groupSettingsMap, setGroupSettingsMap] = useState<Record<string, GroupSettings>>({});
  const [groupPreferenceMap, setGroupPreferenceMap] = useState<Record<string, GroupPreferenceItem>>(
    () => loadGroupPreferences(),
  );
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(true);
  const [scrollToMessageRequest, setScrollToMessageRequest] = useState<{ messageId: string; nonce: number } | null>(null);

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
  const joinInviteInProgressRef = useRef(false);
  const processedInviteCodeRef = useRef<string | null>(null);
  const activeCallRef = useRef<DirectCallSession | null>(null);
  const incomingCallRef = useRef<IncomingCallState | null>(null);
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamsRef = useRef<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingOffersRef = useRef<Record<string, RTCSessionDescriptionInit>>({});
  const pendingIceCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const pendingCallEventsRef = useRef<CallRealtimeEvent[]>([]);
  const peerIceRestartAttemptsRef = useRef<Record<string, number>>({});
  const inviteRetryTimerRef = useRef<number | null>(null);
  const unansweredCallTimerRef = useRef<number | null>(null);
  const groupCallSoloTimerRef = useRef<number | null>(null);
  const callManagerRef = useRef(new CallManager());

  const transitionCallState = useCallback(
    (event: CallLifecycleEvent, callId?: string) => {
      callManagerRef.current.transition(event, callId);
    },
    [],
  );

  const clearOutgoingCallGuards = useCallback(() => {
    if (inviteRetryTimerRef.current) {
      window.clearTimeout(inviteRetryTimerRef.current);
      inviteRetryTimerRef.current = null;
    }
    if (unansweredCallTimerRef.current) {
      window.clearTimeout(unansweredCallTimerRef.current);
      unansweredCallTimerRef.current = null;
    }
    callManagerRef.current.stopOutgoingGuards();
  }, []);

  const clearGroupCallSoloGuard = useCallback(() => {
    if (groupCallSoloTimerRef.current) {
      window.clearTimeout(groupCallSoloTimerRef.current);
      groupCallSoloTimerRef.current = null;
    }
  }, []);

  const upsertGroupCallNotice = useCallback((notice: GroupCallNotice) => {
    setGroupCallNoticeMap((prev) => {
      const existing = prev[notice.conversationId];
      if (
        existing &&
        existing.callId === notice.callId &&
        existing.initiatorUserId === notice.initiatorUserId &&
        existing.mode === notice.mode
      ) {
        return prev;
      }

      return {
        ...prev,
        [notice.conversationId]: existing
          ? {
              ...existing,
              callId: notice.callId,
              initiatorUserId: notice.initiatorUserId,
              initiatorDisplayName: notice.initiatorDisplayName,
              mode: notice.mode,
            }
          : notice,
      };
    });
  }, []);

  const clearGroupCallNotice = useCallback(
    (conversationId: string, callId?: string) => {
      setGroupCallNoticeMap((prev) => {
        const existing = prev[conversationId];
        if (!existing) {
          return prev;
        }
        if (callId && existing.callId !== callId) {
          return prev;
        }

        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    },
    [],
  );

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
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    localCallStreamRef.current = localCallStream;
  }, [localCallStream]);

  useEffect(() => {
    remoteCallStreamsRef.current = remoteCallStreams;
  }, [remoteCallStreams]);

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
    userId: string | null | undefined,
  ): UserPresenceState | undefined => {
    if (!userId) {
      return undefined;
    }

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
      return conversation.ownerId ?? conversation.participants?.[0] ?? null;
    }
    const myId = myUserIdRef.current ?? myProfile?.id ?? null;
    const peer = conversation.participants?.find((id) => id && id !== myId);
    if (peer) {
      return peer;
    }
    return null;
  };

  const getConversationDisplayName = (conversation: ConversationItem) => {
    if (conversation.type === "group") {
      return conversation.name || (language === "vi" ? "Nhom" : "Group");
    }

    const peerUserId = resolvePeerUserId(conversation);
    const profile = peerUserId ? userProfileMap[peerUserId] : undefined;
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

  const getParticipantDisplayName = (userId: string | null | undefined) => {
    if (!userId) {
      return language === "vi" ? "Nguoi dung" : "User";
    }

    const normalizedMyId = myUserIdRef.current ?? myProfile?.id ?? null;
    if (normalizedMyId && userId === normalizedMyId) {
      return language === "vi" ? "Bạn" : "You";
    }

    return userProfileMap[userId]?.fullName ??
      (userId.length >= 8 ? `User ${userId.slice(0, 8)}` : userId);
  };

  const formatLastMessageBody = (conversation: ConversationItem) => {
    const rawType = String(conversation.lastMessageType ?? "TEXT").toUpperCase();
    if (rawType === "IMAGE") {
      return language === "vi" ? "[Hình ảnh]" : "[Image]";
    }
    if (rawType === "FILE") {
      return language === "vi" ? "[File]" : "[File]";
    }
    if (rawType === "VIDEO") {
      return language === "vi" ? "[Video]" : "[Video]";
    }
    if (rawType === "AUDIO") {
      return language === "vi" ? "[Âm thanh]" : "[Audio]";
    }
    if (rawType === "STICKER") {
      return language === "vi" ? "[Sticker]" : "[Sticker]";
    }

    const content = (conversation.lastMessage ?? "").trim();
    return content || "...";
  };

  const formatConversationLastPreview = (conversation: ConversationItem) => {
    const mutedPrefix = groupPreferenceMap[conversation.id]?.muted ? "🔕 " : "";
    const body = formatLastMessageBody(conversation);
    const isGroupConversation = conversation.type === "group";

    if (!isGroupConversation) {
      return `${mutedPrefix}${body}`;
    }

    const senderId = conversation.lastMessageSenderId;
    if (!senderId) {
      return `${mutedPrefix}${body}`;
    }

    return `${mutedPrefix}${getParticipantDisplayName(senderId)}: ${body}`;
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        GROUP_PREFERENCE_STORAGE_KEY,
        JSON.stringify(groupPreferenceMap),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [groupPreferenceMap]);

  const refreshGroupSettings = useCallback(async (conversationId: string) => {
    try {
      const result = await getGroupSettings(conversationId);
      setGroupSettingsMap((prev) => ({
        ...prev,
        [conversationId]: result.data,
      }));
    } catch {
      // Keep stale settings if endpoint fails temporarily.
    }
  }, []);

  useEffect(() => {
    if (!activeConversation || activeConversation.type !== "group") {
      return;
    }
    void refreshGroupSettings(activeConversation.id);
  }, [activeConversation?.id, activeConversation?.type, refreshGroupSettings]);

  useEffect(() => {
    if (activeConversation?.type === "group") {
      setIsGroupPanelOpen(true);
    }
  }, [activeConversation?.id, activeConversation?.type]);

  const ensureHiddenConversationPin = useCallback(() => {
    if (hiddenConversationPin) {
      return hiddenConversationPin;
    }

    const firstPin =
      window.prompt(
        language === "vi"
          ? "Tao ma PIN (4-8 so) de an cuoc tro chuyen"
          : "Create a PIN (4-8 digits) to hide conversations",
      ) ?? "";

    const normalizedFirstPin = firstPin.trim();
    if (!isValidConversationPin(normalizedFirstPin)) {
      setBannerMessage(
        language === "vi"
          ? "PIN phai gom 4 den 8 chu so"
          : "PIN must contain 4 to 8 digits",
      );
      return null;
    }

    const secondPin =
      window.prompt(
        language === "vi" ? "Nhap lai ma PIN" : "Confirm your PIN",
      ) ?? "";

    if (secondPin.trim() !== normalizedFirstPin) {
      setBannerMessage(
        language === "vi" ? "PIN xac nhan khong khop" : "PIN confirmation does not match",
      );
      return null;
    }

    setHiddenConversationPin(normalizedFirstPin);
    persistHiddenConversationPin(normalizedFirstPin);
    setBannerMessage(language === "vi" ? "Da tao ma PIN an chat" : "Hidden-chat PIN created");
    return normalizedFirstPin;
  }, [hiddenConversationPin, language]);

  const verifyHiddenConversationPin = useCallback(() => {
    if (!hiddenConversationPin) {
      return true;
    }

    const enteredPin =
      window.prompt(
        language === "vi"
          ? "Nhap ma PIN de xac nhan an cuoc tro chuyen"
          : "Enter PIN to hide this conversation",
      ) ?? "";

    if (enteredPin.trim() !== hiddenConversationPin) {
      setBannerMessage(language === "vi" ? "Sai ma PIN" : "Incorrect PIN");
      return false;
    }

    return true;
  }, [hiddenConversationPin, language]);

  const updateGroupPreference = useCallback(
    (conversationId: string, patch: Partial<GroupPreferenceItem>) => {
      setGroupPreferenceMap((prev) => {
        const current = prev[conversationId] ?? {
          muted: false,
          pinned: false,
          hidden: false,
        };

        const requestsPin = patch.pinned === true;
        const isAlreadyPinned = Boolean(current.pinned);
        if (requestsPin && !isAlreadyPinned) {
          const pinnedCount = Object.values(prev).filter((item) => item?.pinned).length;
          if (pinnedCount >= 3) {
            setBannerMessage(
              language === "vi"
                ? "Chi duoc ghim toi da 3 hoi thoai"
                : "You can pin up to 3 conversations only",
            );
            return prev;
          }
        }

        if (patch.hidden === true && !current.hidden) {
          const ensuredPin = ensureHiddenConversationPin();
          if (!ensuredPin) {
            return prev;
          }

          if (hiddenConversationPin && !verifyHiddenConversationPin()) {
            return prev;
          }
        }

        const nextItem = {
          ...current,
          ...patch,
        };
        return {
          ...prev,
          [conversationId]: nextItem,
        };
      });
    },
    [ensureHiddenConversationPin, hiddenConversationPin, language, verifyHiddenConversationPin],
  );

  const onAddGroupMembers = async (userIds: string[]) => {
    if (!activeConversationId) {
      return false;
    }

    const uniqueUserIds = Array.from(
      new Set(userIds.map((value) => value.trim()).filter(Boolean)),
    );

    const memberSet = new Set(activeGroupMembers);
    const pendingMemberSet = new Set(
      (groupSettingsMap[activeConversationId]?.pendingParticipants ?? [])
        .map((item) => item.userId?.trim())
        .filter(Boolean),
    );
    const idsToAdd = uniqueUserIds.filter(
      (userId) => !memberSet.has(userId) && !pendingMemberSet.has(userId),
    );

    if (idsToAdd.length === 0) {
      setBannerMessage(
        language === "vi"
          ? "Nhung nguoi da chon da co trong nhom hoac dang cho duyet"
          : "Selected users are already in the group or pending approval",
      );
      return false;
    }

    setIsAddingGroupMembers(true);
    try {
      const results = await Promise.allSettled(
        idsToAdd.map((userId) => addGroupMember(activeConversationId, userId)),
      );

      const successCount = results.filter(
        (item) => item.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        await fetchConversations({ silent: true });
        await refreshGroupSettings(activeConversationId);
      }

      if (failedCount === 0) {
        const requireApproval =
          groupSettingsMap[activeConversationId]?.requireApprovalToJoin ?? false;
        const actorCanApproveDirectly = Boolean(
          groupSettingsMap[activeConversationId]?.isOwner ||
          groupSettingsMap[activeConversationId]?.isAdmin,
        );
        setBannerMessage(
          requireApproval && !actorCanApproveDirectly
            ? language === "vi"
              ? `Da gui ${successCount} yeu cau cho duyet`
              : `Submitted ${successCount} approval request(s)`
            : language === "vi"
              ? `Da them ${successCount} thanh vien`
              : `Added ${successCount} member(s)`,
        );
        return true;
      }

      if (successCount === 0) {
        const firstRejected = results.find(
          (item): item is PromiseRejectedResult => item.status === "rejected",
        );
        setBannerMessage(
          firstRejected
            ? toApiErrorMessage(firstRejected.reason)
            : language === "vi"
              ? "Khong the them thanh vien"
              : "Unable to add members",
        );
        return false;
      }

      setBannerMessage(
        language === "vi"
          ? `Da them ${successCount} thanh vien, ${failedCount} nguoi that bai`
          : `Added ${successCount} member(s), ${failedCount} failed`,
      );
      return true;
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return false;
    } finally {
      setIsAddingGroupMembers(false);
    }
  };

  const onRemoveGroupMember = async (userId: string) => {
    if (!activeConversationId) {
      return;
    }
    try {
      await removeGroupMember(activeConversationId, userId);
      await fetchConversations({ silent: true });
      await refreshGroupSettings(activeConversationId);
      setBannerMessage(
        language === "vi" ? "Da xoa thanh vien" : "Member removed",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onToggleGroupAdmin = async (userId: string, admin: boolean) => {
    if (!activeConversationId) {
      return;
    }
    try {
      await setGroupAdmin(activeConversationId, userId, admin);
      await fetchConversations({ silent: true });
      await refreshGroupSettings(activeConversationId);
      setBannerMessage(
        admin
          ? language === "vi"
            ? "Da cap quyen pho nhom"
            : "Admin role granted"
          : language === "vi"
            ? "Da go quyen pho nhom"
            : "Admin role revoked",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onUpdateActiveGroupSettings = async (input: {
    name?: string;
    avatar?: string | null;
    onlyAdminsCanMessage?: boolean;
    requireApprovalToJoin?: boolean;
    allowMemberInvite?: boolean;
    allowMemberEditGroupInfo?: boolean;
    allowMemberPinBoardItems?: boolean;
    allowMemberCreateNotes?: boolean;
    allowMemberCreateReminders?: boolean;
    allowMemberCreatePolls?: boolean;
    transferOwnerId?: string;
    successMessageVi?: string;
    successMessageEn?: string;
  }) => {
    if (!activeConversationId) {
      return false;
    }

    try {
      const {
        successMessageVi,
        successMessageEn,
        ...payload
      } = input;
      const result = await updateGroupSettings(activeConversationId, payload);
      setGroupSettingsMap((prev) => ({
        ...prev,
        [activeConversationId]: result.data,
      }));

      upsertConversation({
        id: activeConversationId,
        name: result.data.name,
        avatar: result.data.avatar,
        ownerId: result.data.ownerId,
        admins: result.data.admins,
        participants: result.data.participants,
      });

      await fetchConversations({ silent: true });
      setBannerMessage(
        language === "vi"
          ? successMessageVi ?? "Da cap nhat cai dat nhom"
          : successMessageEn ?? "Group settings updated",
      );
      return true;
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return false;
    }
  };

  const onSaveActiveGroupName = async (nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setBannerMessage(
        language === "vi" ? "Ten nhom khong duoc de trong" : "Group name is required",
      );
      return false;
    }

    return onUpdateActiveGroupSettings({
      name: trimmedName,
      successMessageVi: "Da doi ten nhom",
      successMessageEn: "Group name updated",
    });
  };

  const onSelectActiveGroupAvatar = async (file: File | null) => {
    if (!file) {
      return false;
    }

    if (!file.type.startsWith("image/")) {
      setBannerMessage(
        language === "vi"
          ? "Vui long chon file hinh anh"
          : "Please choose an image file",
      );
      return false;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setBannerMessage(
        language === "vi"
          ? "Anh nhom vuot qua 10MB"
          : "Group avatar exceeds 10MB",
      );
      return false;
    }

    try {
      setIsUpdatingGroupProfile(true);
      const uploaded = await uploadMedia(file);
      return onUpdateActiveGroupSettings({
        avatar: uploaded.data.fileUrl,
        successMessageVi: "Da cap nhat anh nhom",
        successMessageEn: "Group avatar updated",
      });
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return false;
    } finally {
      setIsUpdatingGroupProfile(false);
    }
  };

  const onClearActiveGroupAvatar = async () => {
    setIsUpdatingGroupProfile(true);
    try {
      return onUpdateActiveGroupSettings({
        avatar: null,
        successMessageVi: "Da xoa anh nhom",
        successMessageEn: "Group avatar removed",
      });
    } finally {
      setIsUpdatingGroupProfile(false);
    }
  };

  const onLeaveActiveGroup = async () => {
    if (!activeConversationId) {
      return;
    }
    const effectiveOwnerId =
      activeGroupSettings?.ownerId ?? activeConversationForView?.ownerId ?? null;
    const effectiveParticipants =
      activeGroupSettings?.participants ??
      activeConversationForView?.participants ??
      [];
    if (
      myProfile?.id &&
      effectiveOwnerId === myProfile.id &&
      effectiveParticipants.length > 1
    ) {
      setBannerMessage(
        language === "vi"
          ? "Ban phai chuyen quyen truong nhom truoc khi roi nhom"
          : "Transfer ownership before leaving this group",
      );
      return;
    }
    try {
      await leaveGroupConversation(activeConversationId);
      await fetchConversations({ silent: true });
      hasUserOpenedConversationRef.current = false;
      manuallyOpenedConversationIdRef.current = null;
      setActiveConversationId(null);
      setBannerMessage(language === "vi" ? "Da roi nhom" : "Left group");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onDeleteActiveGroup = async () => {
    if (!activeConversationId) {
      return;
    }
    try {
      await deleteGroupConversation(activeConversationId);
      await fetchConversations({ silent: true });
      hasUserOpenedConversationRef.current = false;
      manuallyOpenedConversationIdRef.current = null;
      setActiveConversationId(null);
      setBannerMessage(
        language === "vi" ? "Da giai tan nhom" : "Group deleted",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onMentionGroupMember = (userId: string) => {
    const displayName = userProfileMap[userId]?.fullName ?? userId;
    const mentionToken = `@${displayName.trim().replace(/\s+/g, "_")}`;
    setDraftMessage((prev) =>
      `${prev}${prev.length > 0 && !prev.endsWith(" ") ? " " : ""}${mentionToken} `,
    );
  };

  const onSendGroupTemplateMessage = async (
    type:
      | "STICKER"
      | "GIF"
      | "CONTACT"
      | "LOCATION"
      | "POLL"
      | "REMINDER"
      | "NOTE"
      | "MEETING",
  ) => {
    if (!activeConversationId) {
      return;
    }

    const nowIso = new Date().toISOString();
    const prefixByType: Record<string, string> = {
      STICKER: "Sticker",
      GIF: "GIF",
      CONTACT: "Contact",
      LOCATION: "Location",
      POLL: "Poll",
      REMINDER: "Reminder",
      NOTE: "Note",
      MEETING: "Meeting",
    };

    const title =
      type === "MEETING"
        ? language === "vi"
          ? "Hop nhanh"
          : "Quick meeting"
        : window.prompt(
            language === "vi"
              ? `Nhap noi dung ${prefixByType[type]}`
              : `Enter ${prefixByType[type]} content`,
          ) ?? "";

    if (type !== "MEETING" && !title.trim()) {
      return;
    }

    const payload =
      type === "MEETING"
        ? {
            title,
            link: `https://meet.jit.si/zola-${activeConversationId.slice(0, 8)}-${Date.now().toString(36)}`,
            createdAt: nowIso,
          }
        : {
            title: title.trim(),
            createdAt: nowIso,
          };

    const content = JSON.stringify(payload);

    try {
      const result = await sendMessage(activeConversationId, content, {
        type,
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
          ? `Da gui ${prefixByType[type].toLowerCase()}`
          : `${prefixByType[type]} sent`,
      );
      await fetchConversations({ silent: true });
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onPinGroupMessage = async (targetMessage: { id: string; text: string }) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return;
    }

    const activeSettings = groupSettingsMap[activeConversationId] ?? null;
    const canPinBoardItems = Boolean(
      activeSettings?.isOwner || activeSettings?.isAdmin || activeSettings?.allowMemberPinBoardItems,
    );
    if (!canPinBoardItems) {
      setBannerMessage(
        language === "vi"
          ? "Ban khong duoc phep ghim tin nhan trong nhom nay"
          : "You are not allowed to pin messages in this group",
      );
      return;
    }

    if (activePinnedBoardItems.some((item) => item.sourceMessageId === targetMessage.id)) {
      setBannerMessage(language === "vi" ? "Tin nhan nay da duoc ghim" : "This message is already pinned");
      return;
    }
    if (activePinnedBoardItems.filter((item) => item.itemType === "pin").length >= 3) {
      setBannerMessage(language === "vi" ? "Chi duoc ghim toi da 3 tin nhan" : "You can pin up to 3 messages");
      return;
    }

    try {
      const result = await pinGroupMessage(activeConversationId, targetMessage.id);
      setGroupSettingsMap((prev) => ({
        ...prev,
        [activeConversationId]: result.data,
      }));
      setBannerMessage(language === "vi" ? "Da ghim tin nhan" : "Message pinned");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onApprovePendingGroupMember = async (userId: string) => {
    if (!activeConversationId) {
      return;
    }
    try {
      await approveGroupMember(activeConversationId, userId);
      await fetchConversations({ silent: true });
      await refreshGroupSettings(activeConversationId);
      setBannerMessage(
        language === "vi" ? "Da duyet thanh vien vao nhom" : "Member approved",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onRejectPendingGroupMember = async (userId: string) => {
    if (!activeConversationId) {
      return;
    }
    try {
      await rejectGroupMember(activeConversationId, userId);
      await refreshGroupSettings(activeConversationId);
      setBannerMessage(
        language === "vi" ? "Da tu choi yeu cau vao nhom" : "Join request rejected",
      );
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onUnpinGroupMessage = async (sourceMessageId: string) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return;
    }

    const normalizedSourceId = sourceMessageId.trim();
    if (!normalizedSourceId) {
      return;
    }

    try {
      const result = await unpinGroupMessage(activeConversationId, normalizedSourceId);
      setGroupSettingsMap((prev) => ({
        ...prev,
        [activeConversationId]: result.data,
      }));
      setBannerMessage(language === "vi" ? "Da bo ghim tin nhan" : "Message unpinned");
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onCreateGroupBoardNote = async (noteText: string, pinToTop: boolean) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return;
    }

    const activeSettings = groupSettingsMap[activeConversationId] ?? null;
    const canCreateNotes = Boolean(
      activeSettings?.isOwner || activeSettings?.isAdmin || activeSettings?.allowMemberCreateNotes,
    );
    if (!canCreateNotes) {
      setBannerMessage(
        language === "vi"
          ? "Ban khong duoc phep tao ghi chu trong nhom nay"
          : "You are not allowed to create notes in this group",
      );
      return;
    }

    const trimmed = noteText.trim();
    if (!trimmed) {
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      kind: "BOARD_NOTE",
      title: trimmed,
      note: trimmed,
      preview: trimmed.replace(/\s+/g, " ").slice(0, 140),
      pinToTop,
      createdAt: nowIso,
    };

    try {
      const result = await sendMessage(activeConversationId, JSON.stringify(payload), {
        type: "NOTE",
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
          ? pinToTop
            ? "Da tao ghi chu va ghim len dau"
            : "Da tao ghi chu"
          : pinToTop
            ? "Note created and pinned"
            : "Note created",
      );
      await fetchConversations({ silent: true });
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onCreateGroupPoll = async (input: CreateGroupPollInput) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return false;
    }

    const activeSettings = groupSettingsMap[activeConversationId] ?? null;
    const isCurrentOwner = Boolean(activeSettings?.isOwner);
    const isCurrentAdmin = Boolean(activeSettings?.isAdmin);
    const canCreatePolls = Boolean(
      isCurrentOwner || isCurrentAdmin || activeSettings?.allowMemberCreatePolls,
    );
    if (!canCreatePolls) {
      setBannerMessage(language === "vi" ? "Ban khong duoc phep tao binh chon trong nhom nay" : "You are not allowed to create polls in this group");
      return false;
    }

    const question = input.question.trim();
    const normalizedOptions = input.options
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
    const dedupedOptions: string[] = [];
    const seen = new Set<string>();
    for (const option of normalizedOptions) {
      const key = option.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedupedOptions.push(option);
      }
    }

    if (!question) {
      setBannerMessage(language === "vi" ? "Noi dung binh chon khong duoc de trong" : "Poll question cannot be empty");
      return false;
    }

    if (question.length > 200) {
      setBannerMessage(language === "vi" ? "Noi dung binh chon toi da 200 ky tu" : "Poll question cannot exceed 200 characters");
      return false;
    }

    if (dedupedOptions.length < 2) {
      setBannerMessage(language === "vi" ? "Cuoc binh chon phai co it nhat 2 lua chon" : "Poll must have at least 2 options");
      return false;
    }

    if (dedupedOptions.length > 10) {
      setBannerMessage(language === "vi" ? "Toi da 10 lua chon cho moi cuoc binh chon" : "Poll supports up to 10 options");
      return false;
    }

    if (dedupedOptions.some((option) => option.length > 80)) {
      setBannerMessage(language === "vi" ? "Moi lua chon toi da 80 ky tu" : "Each option can contain up to 80 characters");
      return false;
    }

    if (!Number.isFinite(input.deadlineMinutes) || input.deadlineMinutes < 5 || input.deadlineMinutes > 10080) {
      setBannerMessage(language === "vi" ? "Han binh chon tu 5 phut den 7 ngay" : "Poll duration must be between 5 minutes and 7 days");
      return false;
    }

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + input.deadlineMinutes * 60 * 1000).toISOString();
    const pollId = `poll-${activeConversationId.slice(0, 8)}-${Date.now().toString(36)}`;
    const payload = {
      kind: "GROUP_POLL",
      pollId,
      question,
      title: question,
      options: dedupedOptions.map((option, index) => ({
        id: `opt-${index + 1}`,
        text: option,
      })),
      multipleChoice: input.multipleChoice,
      allowChangeVote: input.allowChangeVote,
      hideResultsBeforeVote: input.hideResultsBeforeVote,
      expiresAt,
      createdAt: nowIso,
    };

    try {
      const result = await sendMessage(activeConversationId, JSON.stringify(payload), {
        type: "POLL",
      });

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === result.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, result.data];
      });

      setBannerMessage(language === "vi" ? "Da tao cuoc binh chon" : "Poll created");
      await fetchConversations({ silent: true });
      return true;
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return false;
    }
  };

  const onCreateGroupReminder = async (input: { title: string; when?: string | null }) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return false;
    }

    const activeSettings = groupSettingsMap[activeConversationId] ?? null;
    const canCreateReminders = Boolean(
      activeSettings?.isOwner || activeSettings?.isAdmin || activeSettings?.allowMemberCreateReminders,
    );
    if (!canCreateReminders) {
      setBannerMessage(
        language === "vi"
          ? "Ban khong duoc phep tao nhac hen trong nhom nay"
          : "You are not allowed to create reminders in this group",
      );
      return false;
    }

    const title = input.title.trim();
    if (!title) {
      setBannerMessage(language === "vi" ? "Tieu de nhac hen khong duoc de trong" : "Reminder title cannot be empty");
      return false;
    }

    const payload = {
      title,
      when: input.when ?? null,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await sendMessage(activeConversationId, JSON.stringify(payload), {
        type: "REMINDER",
      });

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === result.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, result.data];
      });

      setBannerMessage(language === "vi" ? "Da tao nhac hen" : "Reminder created");
      await fetchConversations({ silent: true });
      return true;
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
      return false;
    }
  };

  const onVoteGroupPoll = async (targetMessage: {
    poll?: {
      pollId: string;
      options: Array<{ id: string; selectedByMe: boolean }>;
      multipleChoice: boolean;
      allowChangeVote: boolean;
      hasVotedByMe: boolean;
      isClosed: boolean;
    };
  }, optionId: string) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return;
    }

    const poll = targetMessage.poll;
    if (!poll?.pollId || !optionId) {
      return;
    }

    if (poll.isClosed) {
      setBannerMessage(language === "vi" ? "Cuoc binh chon da ket thuc" : "Poll is closed");
      return;
    }

    if (poll.hasVotedByMe && !poll.allowChangeVote) {
      setBannerMessage(language === "vi" ? "Cuoc binh chon khong cho phep doi dap an" : "This poll does not allow changing votes");
      return;
    }

    const selectedIds = new Set(
      poll.options.filter((option) => option.selectedByMe).map((option) => option.id),
    );
    let nextOptionIds: string[] = [];

    if (poll.multipleChoice) {
      if (selectedIds.has(optionId)) {
        selectedIds.delete(optionId);
      } else {
        selectedIds.add(optionId);
      }
      nextOptionIds = Array.from(selectedIds);
    } else {
      nextOptionIds = [optionId];
    }

    if (nextOptionIds.length === 0) {
      setBannerMessage(language === "vi" ? "Can chon it nhat 1 lua chon" : "Select at least one option");
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      kind: "POLL_VOTE",
      pollId: poll.pollId,
      optionIds: nextOptionIds,
      createdAt: nowIso,
    };

    try {
      const result = await sendMessage(activeConversationId, JSON.stringify(payload), {
        type: "POLL",
      });

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === result.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, result.data];
      });

      setBannerMessage(language === "vi" ? "Da cap nhat binh chon" : "Vote updated");
      await fetchConversations({ silent: true });
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const onCloseGroupPoll = async (targetMessage: { poll?: { pollId: string; isClosed: boolean } }) => {
    if (!activeConversationId || activeConversation?.type !== "group") {
      return;
    }

    const poll = targetMessage.poll;
    if (!poll?.pollId || poll.isClosed) {
      return;
    }

    const activeSettings = groupSettingsMap[activeConversationId] ?? null;
    const isCurrentOwner = Boolean(activeSettings?.isOwner);
    const isCurrentAdmin = Boolean(activeSettings?.isAdmin);
    if (!isCurrentOwner && !isCurrentAdmin) {
      setBannerMessage(language === "vi" ? "Chi truong/pho nhom moi duoc ket thuc binh chon" : "Only owner/admin can close polls");
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      kind: "POLL_CLOSE",
      pollId: poll.pollId,
      createdAt: nowIso,
    };

    try {
      const result = await sendMessage(activeConversationId, JSON.stringify(payload), {
        type: "POLL",
      });

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === result.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, result.data];
      });

      setBannerMessage(language === "vi" ? "Da ket thuc binh chon" : "Poll closed");
      await fetchConversations({ silent: true });
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const appendCallHistory = useCallback((item: QuickCallHistoryItem) => {
    setCallHistory((prev) => [item, ...prev].slice(0, 30));
  }, []);

  const updateCallHistoryStatus = useCallback(
    (callId: string, status: QuickCallHistoryItem["status"]) => {
      setCallHistory((prev) =>
        prev.map((item) => (item.id === callId ? { ...item, status } : item)),
      );
    },
    [],
  );

  const addParticipantToActiveCall = useCallback((userId: string) => {
    if (!userId) {
      return;
    }

    setActiveCall((prev) => {
      if (!prev || prev.participantIds.includes(userId)) {
        return prev;
      }

      return {
        ...prev,
        participantIds: [...prev.participantIds, userId],
      };
    });
  }, []);

  const removeParticipantFromActiveCall = useCallback((userId: string) => {
    if (!userId) {
      return;
    }

    setActiveCall((prev) => {
      if (!prev || !prev.participantIds.includes(userId)) {
        return prev;
      }

      return {
        ...prev,
        participantIds: prev.participantIds.filter((id) => id !== userId),
      };
    });
  }, []);

  const closePeerConnection = useCallback(
    (peerUserId: string) => {
      const connection = peerConnectionsRef.current[peerUserId];
      if (connection) {
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.onconnectionstatechange = null;
        connection.close();
        delete peerConnectionsRef.current[peerUserId];
      }

      delete pendingOffersRef.current[peerUserId];
      delete pendingIceCandidatesRef.current[peerUserId];
      delete peerIceRestartAttemptsRef.current[peerUserId];

      const remoteStream = remoteCallStreamsRef.current[peerUserId];
      delete remoteCallStreamsRef.current[peerUserId];
      if (remoteStream) {
        stopMediaStream(remoteStream);
        setRemoteCallStreams((prev) => {
          const next = { ...prev };
          delete next[peerUserId];
          remoteCallStreamsRef.current = next;
          return next;
        });
      }

      removeParticipantFromActiveCall(peerUserId);
    },
    [removeParticipantFromActiveCall],
  );

  const resetCallRuntime = useCallback(() => {
    clearOutgoingCallGuards();
    clearGroupCallSoloGuard();

    Object.values(peerConnectionsRef.current).forEach((connection) => {
      connection.onicecandidate = null;
      connection.oniceconnectionstatechange = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      connection.close();
    });
    peerConnectionsRef.current = {};

    pendingOffersRef.current = {};
    pendingIceCandidatesRef.current = {};
    peerIceRestartAttemptsRef.current = {};

    stopMediaStream(localCallStreamRef.current);
    Object.values(remoteCallStreamsRef.current).forEach((stream) => {
      stopMediaStream(stream);
    });
    localCallStreamRef.current = null;
    remoteCallStreamsRef.current = {};

    setLocalCallStream(null);
    setRemoteCallStreams({});
    setIncomingCall(null);
    setActiveCall(null);
    setIsMicrophoneEnabled(true);
    setIsCameraEnabled(true);
    transitionCallState("RESET");
  }, [clearGroupCallSoloGuard, clearOutgoingCallGuards, transitionCallState]);

  const publishCallSignal = useCallback(
    (
      conversationId: string,
      targetUserId: string | null,
      callId: string,
      mode: InAppCallMode,
      signalType: CallSignalType,
      payload?: unknown,
    ) => {
      const client = realtimeClientRef.current;
      if (!client || !client.isConnected()) {
        return false;
      }

      return client.publishCallSignal(
        conversationId,
        targetUserId,
        callId,
        mode,
        signalType,
        payload,
      );
    },
    [],
  );

  const acquireLocalStream = useCallback(
    async (mode: InAppCallMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          language === "vi"
            ? "Trinh duyet khong ho tro cuoc goi"
            : "This browser does not support in-app calling",
        );
      }

      stopMediaStream(localCallStreamRef.current);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          mode === "video"
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
      });

      stream.getVideoTracks().forEach((track) => {
        track.enabled = mode === "video";
      });

      localCallStreamRef.current = stream;
      remoteCallStreamsRef.current = {};
      setLocalCallStream(stream);
      setRemoteCallStreams({});
      setIsMicrophoneEnabled(true);
      setIsCameraEnabled(mode === "video" && stream.getVideoTracks().length > 0);
      return stream;
    },
    [language],
  );

  const flushPendingIceCandidatesForPeer = useCallback(async (peerUserId: string) => {
    const connection = peerConnectionsRef.current[peerUserId];
    if (!connection || !connection.remoteDescription) {
      return;
    }

    const pending = [...(pendingIceCandidatesRef.current[peerUserId] ?? [])];
    delete pendingIceCandidatesRef.current[peerUserId];

    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(candidate);
      } catch {
        // Ignore malformed candidate payloads from older clients.
      }
    }
  }, []);

  const attachLocalTracks = useCallback((connection: RTCPeerConnection) => {
    const localStream = localCallStreamRef.current;
    if (!localStream) {
      return;
    }

    const attachedTrackIds = new Set(
      connection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId)),
    );

    localStream.getTracks().forEach((track) => {
      if (!attachedTrackIds.has(track.id)) {
        connection.addTrack(track, localStream);
      }
    });
  }, []);

  const createPeerConnection = useCallback(
    (session: DirectCallSession, peerUserId: string) => {
      const existingConnection = peerConnectionsRef.current[peerUserId];
      if (
        existingConnection &&
        existingConnection.connectionState !== "closed" &&
        existingConnection.connectionState !== "failed"
      ) {
        return existingConnection;
      }

      if (existingConnection) {
        existingConnection.onicecandidate = null;
        existingConnection.oniceconnectionstatechange = null;
        existingConnection.ontrack = null;
        existingConnection.onconnectionstatechange = null;
        existingConnection.close();
        delete peerConnectionsRef.current[peerUserId];
      }

      const shouldForceRelay =
        WEBRTC_FORCE_RELAY ||
        (peerIceRestartAttemptsRef.current[peerUserId] ?? 0) > 0;

      const connection = new RTCPeerConnection({
        iceServers: WEBRTC_ICE_SERVERS,
        iceTransportPolicy: shouldForceRelay ? "relay" : WEBRTC_ICE_POLICY,
      });

      connection.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        publishCallSignal(
          session.conversationId,
          peerUserId,
          session.callId,
          session.mode,
          "WEBRTC_ICE",
          {
            candidate: event.candidate.toJSON(),
            iceConnectionState: connection.iceConnectionState,
          },
        );
      };

      connection.oniceconnectionstatechange = () => {
        if (!activeCallRef.current || activeCallRef.current.callId !== session.callId) {
          return;
        }

        const iceState = connection.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          peerIceRestartAttemptsRef.current[peerUserId] = 0;
          return;
        }

        if (iceState !== "failed" && iceState !== "disconnected") {
          return;
        }

        const attempts = peerIceRestartAttemptsRef.current[peerUserId] ?? 0;
        if (attempts >= 2) {
          closePeerConnection(peerUserId);
          return;
        }
        peerIceRestartAttemptsRef.current[peerUserId] = attempts + 1;

        void (async () => {
          try {
            if (connection.signalingState !== "stable") {
              return;
            }

            if (attempts === 0 && !WEBRTC_FORCE_RELAY) {
              connection.setConfiguration({
                iceServers: WEBRTC_ICE_SERVERS,
                iceTransportPolicy: "relay",
              });
            }

            const restartOffer = await connection.createOffer({
              iceRestart: true,
              offerToReceiveAudio: true,
              offerToReceiveVideo: session.mode === "video",
            });
            await connection.setLocalDescription(restartOffer);

            publishCallSignal(
              session.conversationId,
              peerUserId,
              session.callId,
              session.mode,
              "WEBRTC_OFFER",
              {
                description: restartOffer,
                initiatorUserId: session.initiatorUserId,
                conversationType: session.conversationType,
                restart: true,
              },
            );
          } catch {
            closePeerConnection(peerUserId);
          }
        })();
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteCallStreams((prev) => {
          if (stream) {
            const next = {
              ...prev,
              [peerUserId]: stream,
            };
            remoteCallStreamsRef.current = next;
            return next;
          }

          const fallback = prev[peerUserId] ?? new MediaStream();
          fallback.addTrack(event.track);
          const next = {
            ...prev,
            [peerUserId]: fallback,
          };
          remoteCallStreamsRef.current = next;
          return next;
        });

        setActiveCall((prev) =>
          prev && prev.callId === session.callId
            ? {
                ...prev,
                status: "connected",
                connectedAt: prev.connectedAt ?? new Date().toISOString(),
              }
            : prev,
        );
        updateCallHistoryStatus(session.callId, "connected");
        addParticipantToActiveCall(peerUserId);
      };

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") {
          clearOutgoingCallGuards();
          transitionCallState("PEER_CONNECTED", session.callId);
          setActiveCall((prev) =>
            prev && prev.callId === session.callId
              ? {
                  ...prev,
                  status: "connected",
                  connectedAt: prev.connectedAt ?? new Date().toISOString(),
                }
              : prev,
          );
          updateCallHistoryStatus(session.callId, "connected");
          addParticipantToActiveCall(peerUserId);
          return;
        }

        if (connection.connectionState === "failed") {
          closePeerConnection(peerUserId);
          setBannerMessage(
            language === "vi"
              ? "Mat ket noi voi mot thanh vien trong cuoc goi"
              : "Connection with one participant was lost",
          );
          return;
        }

        if (connection.connectionState === "closed") {
          closePeerConnection(peerUserId);
        }
      };

      peerConnectionsRef.current[peerUserId] = connection;
      return connection;
    },
    [
      addParticipantToActiveCall,
      clearOutgoingCallGuards,
      closePeerConnection,
      language,
      publishCallSignal,
      transitionCallState,
      updateCallHistoryStatus,
    ],
  );

  const processPendingOffer = useCallback(
    async (session: DirectCallSession, peerUserId: string) => {
      const offer = pendingOffersRef.current[peerUserId];
      const connection = createPeerConnection(session, peerUserId);
      if (!offer || !connection) {
        return false;
      }

      attachLocalTracks(connection);

      if (connection.signalingState === "have-local-offer") {
        await connection.setLocalDescription({ type: "rollback" });
      }

      await connection.setRemoteDescription(offer);
      delete pendingOffersRef.current[peerUserId];
      await flushPendingIceCandidatesForPeer(peerUserId);

      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      const sent = publishCallSignal(
        session.conversationId,
        peerUserId,
        session.callId,
        session.mode,
        "WEBRTC_ANSWER",
        {
          description: answer,
          initiatorUserId: session.initiatorUserId,
          conversationType: session.conversationType,
        },
      );

      if (!sent) {
        throw new Error(
          language === "vi"
            ? "Khong gui duoc tin hieu tra loi cuoc goi"
            : "Cannot send call answer signal",
        );
      }

      return true;
    },
    [
      attachLocalTracks,
      createPeerConnection,
      flushPendingIceCandidatesForPeer,
      language,
      publishCallSignal,
    ],
  );

  const createOfferForPeer = useCallback(
    async (session: DirectCallSession, peerUserId: string) => {
      const connection = createPeerConnection(session, peerUserId);
      attachLocalTracks(connection);

      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: session.mode === "video",
      });
      await connection.setLocalDescription(offer);

      const sent = publishCallSignal(
        session.conversationId,
        peerUserId,
        session.callId,
        session.mode,
        "WEBRTC_OFFER",
        {
          description: offer,
          initiatorUserId: session.initiatorUserId,
          conversationType: session.conversationType,
        },
      );

      if (!sent) {
        throw new Error(
          language === "vi"
            ? "Khong the gui loi moi ket noi video"
            : "Cannot send call negotiation offer",
        );
      }
    },
    [attachLocalTracks, createPeerConnection, language, publishCallSignal],
  );

  const onEndDirectCall = useCallback(
    (reason = "ended", notifyPeer = true, forceGroupEnd = false) => {
      const currentCall = activeCallRef.current;
      if (currentCall && notifyPeer) {
        const myUserId = myUserIdRef.current;

        if (currentCall.conversationType === "group") {
          const signalType: CallSignalType =
            forceGroupEnd || (myUserId && currentCall.initiatorUserId === myUserId)
              ? "CALL_END"
              : "CALL_LEAVE";

          publishCallSignal(
            currentCall.conversationId,
            null,
            currentCall.callId,
            currentCall.mode,
            signalType,
            {
              reason,
              initiatorUserId: currentCall.initiatorUserId,
              conversationType: "group",
            },
          );
        } else if (currentCall.peerUserId) {
          publishCallSignal(
            currentCall.conversationId,
            currentCall.peerUserId,
            currentCall.callId,
            currentCall.mode,
            "CALL_END",
            {
              reason,
              initiatorUserId: currentCall.initiatorUserId,
              conversationType: "private",
            },
          );
        }

        if (
          currentCall.conversationType === "group" &&
          (forceGroupEnd || (myUserId && currentCall.initiatorUserId === myUserId))
        ) {
          clearGroupCallNotice(currentCall.conversationId, currentCall.callId);
        }
      }

      if (currentCall) {
        clearOutgoingCallGuards();
        transitionCallState("END", currentCall.callId);
        updateCallHistoryStatus(currentCall.callId, "ended");
      }

      resetCallRuntime();
    },
    [
      clearGroupCallNotice,
      clearOutgoingCallGuards,
      publishCallSignal,
      resetCallRuntime,
      transitionCallState,
      updateCallHistoryStatus,
    ],
  );

  useEffect(() => {
    const currentCall = activeCall;
    if (!currentCall || currentCall.conversationType !== "group") {
      clearGroupCallSoloGuard();
      return;
    }

    if (currentCall.participantIds.length > 0) {
      clearGroupCallSoloGuard();
      return;
    }

    if (groupCallSoloTimerRef.current) {
      return;
    }

    groupCallSoloTimerRef.current = window.setTimeout(() => {
      const latestCall = activeCallRef.current;
      if (!latestCall || latestCall.conversationType !== "group") {
        return;
      }
      if (latestCall.participantIds.length > 0) {
        return;
      }

      setBannerMessage(
        language === "vi"
          ? "Khong con ai trong cuoc goi nhom, cuoc goi da duoc ket thuc"
          : "No one else is in the group call, call has been ended",
      );
      onEndDirectCall("group_single_participant_timeout", true, true);
    }, GROUP_CALL_SOLO_TIMEOUT_MS);

    return () => {
      clearGroupCallSoloGuard();
    };
  }, [activeCall, clearGroupCallSoloGuard, language, onEndDirectCall]);

  const onRejectIncomingCall = useCallback(() => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) {
      return;
    }

    publishCallSignal(
      pendingCall.conversationId,
      pendingCall.peerUserId,
      pendingCall.callId,
      pendingCall.mode,
      "CALL_REJECT",
      {
        reason: "declined",
        initiatorUserId: pendingCall.initiatorUserId,
        conversationType: pendingCall.conversationType,
      },
    );

    appendCallHistory({
      id: pendingCall.callId,
      conversationId: pendingCall.conversationId,
      conversationName: pendingCall.peerDisplayName,
      mode: pendingCall.mode,
      direction: "incoming",
      status: "rejected",
      createdAt: new Date().toISOString(),
    });

    transitionCallState("END", pendingCall.callId);

    setIncomingCall(null);
    pendingOffersRef.current = {};
    pendingIceCandidatesRef.current = {};
  }, [appendCallHistory, publishCallSignal, transitionCallState]);

  const onAcceptIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) {
      return;
    }

    hasUserOpenedConversationRef.current = true;
    manuallyOpenedConversationIdRef.current = pendingCall.conversationId;
    setActiveConversationId(pendingCall.conversationId);
    setActiveTab("messages");
    setIncomingCall(null);

    const session: DirectCallSession = {
      callId: pendingCall.callId,
      conversationId: pendingCall.conversationId,
      conversationType: pendingCall.conversationType,
      initiatorUserId: pendingCall.initiatorUserId,
      peerUserId:
        pendingCall.conversationType === "private"
          ? pendingCall.peerUserId
          : undefined,
      peerDisplayName: pendingCall.peerDisplayName,
      mode: pendingCall.mode,
      direction: "incoming",
      status: "connecting",
      startedAt: new Date().toISOString(),
      connectedAt: null,
      participantIds: [],
    };

    transitionCallState("LOCAL_ACCEPTED", session.callId);
    setActiveCall(session);
    appendCallHistory({
      id: session.callId,
      conversationId: session.conversationId,
      conversationName: session.peerDisplayName,
      mode: session.mode,
      direction: "incoming",
      status: "started",
      createdAt: session.startedAt,
    });

    try {
      await acquireLocalStream(session.mode);

      const acceptSent = publishCallSignal(
        session.conversationId,
        pendingCall.peerUserId,
        session.callId,
        session.mode,
        "CALL_ACCEPT",
        {
          acceptedAt: new Date().toISOString(),
          initiatorUserId: session.initiatorUserId,
          conversationType: session.conversationType,
        },
      );

      if (!acceptSent) {
        throw new Error(
          language === "vi"
            ? "Khong the nhan cuoc goi khi realtime dang ngat"
            : "Cannot answer call while realtime is disconnected",
        );
      }

      if (session.conversationType === "group") {
        publishCallSignal(
          session.conversationId,
          null,
          session.callId,
          session.mode,
          "CALL_JOINED",
          {
            initiatorUserId: session.initiatorUserId,
            conversationType: "group",
          },
        );

        const offerSources = Object.keys(pendingOffersRef.current);
        for (const peerUserId of offerSources) {
          await processPendingOffer(session, peerUserId);
        }
      } else if (pendingCall.peerUserId) {
        await processPendingOffer(session, pendingCall.peerUserId);
      }
    } catch (error) {
      publishCallSignal(
        session.conversationId,
        pendingCall.peerUserId,
        session.callId,
        session.mode,
        "CALL_END",
        {
          reason: "accept_failed",
          initiatorUserId: session.initiatorUserId,
          conversationType: session.conversationType,
        },
      );
      updateCallHistoryStatus(session.callId, "missed");
      resetCallRuntime();

      const detail = (error as { message?: string })?.message;
      setBannerMessage(detail || toApiErrorMessage(error));
    }
  }, [
    acquireLocalStream,
    appendCallHistory,
    language,
    processPendingOffer,
    publishCallSignal,
    setActiveConversationId,
    updateCallHistoryStatus,
    resetCallRuntime,
  ]);

  const onToggleMicrophone = useCallback(() => {
    const stream = localCallStreamRef.current;
    if (!stream) {
      return;
    }

    const nextEnabled = !isMicrophoneEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsMicrophoneEnabled(nextEnabled);
  }, [isMicrophoneEnabled]);

  const onToggleCamera = useCallback(() => {
    const stream = localCallStreamRef.current;
    const call = activeCallRef.current;
    if (!stream || !call || call.mode !== "video") {
      return;
    }

    const nextEnabled = !isCameraEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }, [isCameraEnabled]);

  const startOutgoingCallGuards = useCallback(
    (session: DirectCallSession) => {
      clearOutgoingCallGuards();
      callManagerRef.current.startOutgoingGuards(session.callId);

      const inviteTarget =
        session.conversationType === "group" ? null : session.peerUserId ?? null;

      const scheduleRetry = () => {
        inviteRetryTimerRef.current = window.setTimeout(() => {
          const currentCall = activeCallRef.current;
          if (!currentCall || currentCall.callId !== session.callId) {
            return;
          }
          if (
            currentCall.status === "connected" ||
            currentCall.status === "connecting"
          ) {
            return;
          }

          publishCallSignal(
            session.conversationId,
            inviteTarget,
            session.callId,
            session.mode,
            "CALL_INVITE",
            {
              createdAt: session.startedAt,
              initiatorUserId: session.initiatorUserId,
              conversationType: session.conversationType,
              retry: true,
            },
          );

          scheduleRetry();
        }, CALL_INVITE_RETRY_MS);
      };

      scheduleRetry();

      unansweredCallTimerRef.current = window.setTimeout(() => {
        const currentCall = activeCallRef.current;
        if (!currentCall || currentCall.callId !== session.callId) {
          return;
        }
        if (currentCall.status === "connected") {
          return;
        }

        transitionCallState("TIMEOUT", session.callId);
        publishCallSignal(
          session.conversationId,
          inviteTarget,
          session.callId,
          session.mode,
          "CALL_END",
          {
            reason: "no_answer_timeout",
            initiatorUserId: session.initiatorUserId,
            conversationType: session.conversationType,
          },
        );
        updateCallHistoryStatus(session.callId, "missed");
        resetCallRuntime();
        setBannerMessage(
          language === "vi"
            ? "Khong co phan hoi cuoc goi"
            : "Call timed out without answer",
        );
      }, CALL_CONNECT_TIMEOUT_MS);
    },
    [
      clearOutgoingCallGuards,
      language,
      publishCallSignal,
      resetCallRuntime,
      transitionCallState,
      updateCallHistoryStatus,
    ],
  );

  const handleCallEvent = useCallback(
    (event: CallRealtimeEvent) => {
      const myUserId = myUserIdRef.current;
      logCallDebug("event-received", {
        signalType: event.signalType,
        callId: event.callId,
        actorId: event.actorId,
        targetUserId: event.targetUserId,
        conversationId: event.conversationId,
      });

      if (!event.callId || !event.conversationId) {
        logCallDebug("drop-missing-context", {
          hasMyUserId: Boolean(myUserId),
          hasCallId: Boolean(event.callId),
          hasConversationId: Boolean(event.conversationId),
        });
        return;
      }

      const knownConversationIds = conversationIdsRef.current;
      if (
        knownConversationIds.length > 0 &&
        !knownConversationIds.includes(event.conversationId)
      ) {
        logCallDebug("drop-unknown-conversation", {
          callId: event.callId,
          conversationId: event.conversationId,
        });
        return;
      }

      if (!myUserId) {
        pendingCallEventsRef.current.push(event);
        if (pendingCallEventsRef.current.length > 40) {
          pendingCallEventsRef.current.shift();
        }
        logCallDebug("queue-no-user-context", {
          callId: event.callId,
          conversationId: event.conversationId,
          signalType: event.signalType,
          queued: pendingCallEventsRef.current.length,
        });
        return;
      }

      // Ignore the server echo for the sender tab.
      if (event.actorId === myUserId) {
        logCallDebug("drop-self-echo", {
          signalType: event.signalType,
          callId: event.callId,
        });
        return;
      }

      if (event.targetUserId && event.targetUserId !== myUserId) {
        logCallDebug("drop-target-mismatch", {
          signalType: event.signalType,
          callId: event.callId,
          expectedUserId: myUserId,
          actualTargetUserId: event.targetUserId,
        });
        return;
      }

      const mode: InAppCallMode = event.mode === "video" ? "video" : "voice";
      const peerDisplayName =
        userProfileMapRef.current[event.actorId]?.fullName ??
        `User ${event.actorId.slice(0, 8)}`;
      const payload = parseCallSignalPayload(event.payload);
      const conversationType: "private" | "group" =
        payload.conversationType === "group" || event.targetUserId === null
          ? "group"
          : "private";
      const initiatorUserId = payload.initiatorUserId ?? event.actorId;

      if (conversationType === "group" && event.signalType === "CALL_INVITE") {
        upsertGroupCallNotice({
          callId: event.callId,
          conversationId: event.conversationId,
          initiatorUserId,
          initiatorDisplayName: peerDisplayName,
          mode,
          createdAt: event.createdAt,
        });
      }

      const currentCall = activeCallRef.current;
      if (currentCall && currentCall.callId !== event.callId && event.signalType === "CALL_INVITE") {
        publishCallSignal(event.conversationId, event.actorId, event.callId, mode, "CALL_REJECT", {
          reason: "busy",
          initiatorUserId,
          conversationType,
        });
        return;
      }

      if (currentCall && currentCall.callId !== event.callId) {
        return;
      }

      if (event.signalType === "CALL_INVITE") {
        if (!activeCallRef.current) {
          logCallDebug("incoming-invite", {
            callId: event.callId,
            actorId: event.actorId,
            conversationId: event.conversationId,
            conversationType,
          });
          transitionCallState("INCOMING_INVITE", event.callId);
          setIncomingCall({
            callId: event.callId,
            conversationId: event.conversationId,
            conversationType,
            initiatorUserId,
            peerUserId: event.actorId,
            peerDisplayName,
            mode,
          });
          setBannerMessage(
            conversationType === "group"
              ? language === "vi"
                ? `${peerDisplayName} dang mo cuoc goi nhom`
                : `${peerDisplayName} started a group call`
              : language === "vi"
                ? `${peerDisplayName} dang goi cho ban`
                : `${peerDisplayName} is calling you`,
          );
        }
        return;
      }

      if (event.signalType === "CALL_ACCEPT") {
        if (currentCall && currentCall.callId === event.callId) {
          clearOutgoingCallGuards();
          transitionCallState("REMOTE_ACCEPTED", event.callId);
          setActiveCall((prev) =>
            prev && prev.callId === event.callId
              ? { ...prev, status: "connecting" }
              : prev,
          );
          addParticipantToActiveCall(event.actorId);

          if (currentCall.conversationType === "private") {
            const connection = peerConnectionsRef.current[event.actorId];
            const shouldCreateFallbackOffer =
              !connection || !connection.localDescription;
            if (shouldCreateFallbackOffer) {
              void createOfferForPeer(currentCall, event.actorId).catch(() => {
                closePeerConnection(event.actorId);
              });
            }
          }
        }
        return;
      }

      if (event.signalType === "CALL_REJECT") {
        if (currentCall && currentCall.callId === event.callId) {
          clearOutgoingCallGuards();
          transitionCallState("END", event.callId);
          if (currentCall.conversationType === "private") {
            updateCallHistoryStatus(event.callId, "rejected");
            resetCallRuntime();
          }

          const reason = payload.reason ?? "declined";
          setBannerMessage(
            reason === "busy"
              ? language === "vi"
                ? `${peerDisplayName} dang ban`
                : `${peerDisplayName} is busy`
              : language === "vi"
                ? `${peerDisplayName} da tu choi cuoc goi`
                : `${peerDisplayName} declined the call`,
          );
        }
        return;
      }

      if (event.signalType === "CALL_JOINED") {
        if (conversationType === "group") {
          upsertGroupCallNotice({
            callId: event.callId,
            conversationId: event.conversationId,
            initiatorUserId,
            initiatorDisplayName: peerDisplayName,
            mode,
            createdAt: event.createdAt,
          });
        }

        if (!currentCall || currentCall.callId !== event.callId) {
          return;
        }

        addParticipantToActiveCall(event.actorId);

        if (event.actorId === myUserId) {
          return;
        }

        void createOfferForPeer(currentCall, event.actorId).catch(() => {
          closePeerConnection(event.actorId);
        });
        return;
      }

      if (event.signalType === "CALL_LEAVE") {
        if (!currentCall || currentCall.callId !== event.callId) {
          return;
        }

        closePeerConnection(event.actorId);
        if (currentCall.conversationType === "private") {
          clearOutgoingCallGuards();
          transitionCallState("END", event.callId);
          updateCallHistoryStatus(event.callId, "ended");
          resetCallRuntime();
          return;
        }
        setBannerMessage(
          language === "vi"
            ? `${peerDisplayName} da roi cuoc goi`
            : `${peerDisplayName} left the call`,
        );
        return;
      }

      if (event.signalType === "CALL_END") {
        if (conversationType === "group") {
          clearGroupCallNotice(event.conversationId, event.callId);
        }

        if (currentCall && currentCall.callId === event.callId) {
          clearOutgoingCallGuards();
          transitionCallState("END", event.callId);
          updateCallHistoryStatus(event.callId, "ended");
          resetCallRuntime();
          setBannerMessage(
            language === "vi"
              ? `${peerDisplayName} da ket thuc cuoc goi`
              : `${peerDisplayName} ended the call`,
          );
        }
        if (incomingCallRef.current?.callId === event.callId) {
          setIncomingCall(null);
        }
        return;
      }

      if (event.signalType === "WEBRTC_OFFER") {
        if (!payload.description) {
          return;
        }

        pendingOffersRef.current[event.actorId] = payload.description;

        if (!activeCallRef.current) {
          setIncomingCall({
            callId: event.callId,
            conversationId: event.conversationId,
            conversationType,
            initiatorUserId,
            peerUserId: event.actorId,
            peerDisplayName,
            mode,
          });
          return;
        }

        if (activeCallRef.current.callId === event.callId) {
          void processPendingOffer(activeCallRef.current, event.actorId).catch(() => {
            updateCallHistoryStatus(event.callId, "missed");
            closePeerConnection(event.actorId);
          });
        }
        return;
      }

      if (event.signalType === "WEBRTC_ANSWER") {
        if (!payload.description || !currentCall || currentCall.callId !== event.callId) {
          return;
        }

        const connection = peerConnectionsRef.current[event.actorId];
        if (!connection) {
          return;
        }

        void (async () => {
          try {
            if (connection.signalingState === "closed") {
              return;
            }
            await connection.setRemoteDescription(payload.description as RTCSessionDescriptionInit);
            await flushPendingIceCandidatesForPeer(event.actorId);
            setActiveCall((prev) =>
              prev && prev.callId === event.callId
                ? { ...prev, status: "connecting" }
                : prev,
            );
          } catch {
            updateCallHistoryStatus(event.callId, "ended");
            resetCallRuntime();
            setBannerMessage(
              language === "vi"
                ? "Khong the ket noi cuoc goi"
                : "Cannot establish call connection",
            );
          }
        })();
        return;
      }

      if (event.signalType === "WEBRTC_ICE") {
        if (!payload.candidate || !currentCall || currentCall.callId !== event.callId) {
          return;
        }

        const connection = peerConnectionsRef.current[event.actorId];
        if (!connection) {
          const pending = pendingIceCandidatesRef.current[event.actorId] ?? [];
          pending.push(payload.candidate);
          pendingIceCandidatesRef.current[event.actorId] = pending;
          return;
        }

        if (connection.remoteDescription) {
          void connection.addIceCandidate(payload.candidate).catch(() => {
            // Ignore malformed candidate payloads.
          });
        } else {
          const pending = pendingIceCandidatesRef.current[event.actorId] ?? [];
          pending.push(payload.candidate);
          pendingIceCandidatesRef.current[event.actorId] = pending;
        }
      }
    },
    [
      addParticipantToActiveCall,
      clearGroupCallNotice,
      clearOutgoingCallGuards,
      closePeerConnection,
      createOfferForPeer,
      flushPendingIceCandidatesForPeer,
      language,
      processPendingOffer,
      publishCallSignal,
      resetCallRuntime,
      transitionCallState,
      upsertGroupCallNotice,
      updateCallHistoryStatus,
    ],
  );

  useEffect(() => {
    if (!myUserIdRef.current || pendingCallEventsRef.current.length === 0) {
      return;
    }

    const pendingEvents = [...pendingCallEventsRef.current];
    pendingCallEventsRef.current = [];
    logCallDebug("replay-pending-events", {
      count: pendingEvents.length,
    });
    pendingEvents.forEach((pendingEvent) => {
      handleCallEvent(pendingEvent);
    });
  }, [handleCallEvent, myProfile?.id]);

  const onStartQuickCall = async (mode: QuickCallMode) => {
    if (activeCallRef.current) {
      setBannerMessage(
        language === "vi"
          ? "Hay ket thuc cuoc goi hien tai truoc"
          : "Please end the current call first",
      );
      return;
    }

    if (!activeConversationId || !activeConversation) {
      setBannerMessage(
        language === "vi"
          ? "Hay chon cuoc tro chuyen truoc khi goi"
          : "Select a conversation before starting a call",
      );
      return;
    }

    const currentUserId = myUserIdRef.current;
    if (!currentUserId) {
      setBannerMessage(
        language === "vi"
          ? "Thong tin tai khoan chua san sang, vui long thu lai"
          : "Account context is not ready yet, please try again",
      );
      return;
    }

    const conversationType: "private" | "group" =
      activeConversation.type === "group" ? "group" : "private";

    const peerUserId =
      conversationType === "private"
        ? resolvePeerUserId(activeConversation)
        : undefined;

    if (conversationType === "private" && (!peerUserId || peerUserId === myUserIdRef.current)) {
      setBannerMessage(
        language === "vi"
          ? "Khong xac dinh duoc nguoi nhan"
          : "Cannot determine call recipient",
      );
      return;
    }

    const startedAt = new Date().toISOString();
    const callId = `${activeConversationId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const initiatorUserId = currentUserId;
    const session: DirectCallSession = {
      callId,
      conversationId: activeConversationId,
      conversationType,
      initiatorUserId,
      peerUserId: peerUserId ?? undefined,
      peerDisplayName: getConversationDisplayName(activeConversation),
      mode,
      direction: "outgoing",
      status: "calling",
      startedAt,
      connectedAt: null,
      participantIds: [],
    };

    if (conversationType === "group") {
      upsertGroupCallNotice({
        callId,
        conversationId: activeConversationId,
        initiatorUserId,
        initiatorDisplayName: session.peerDisplayName,
        mode,
        createdAt: startedAt,
      });
    }

    setIncomingCall(null);
    setActiveCall(session);
    setActiveTab("messages");

    appendCallHistory({
      id: callId,
      conversationId: activeConversationId,
      conversationName: session.peerDisplayName,
      mode,
      direction: "outgoing",
      status: "started",
      createdAt: startedAt,
    });

    try {
      await acquireLocalStream(mode);

      const inviteTarget = conversationType === "group" ? null : peerUserId ?? null;
      const inviteSent = publishCallSignal(
        session.conversationId,
        inviteTarget,
        session.callId,
        session.mode,
        "CALL_INVITE",
        {
          createdAt: startedAt,
          initiatorUserId,
          conversationType,
        },
      );

      if (!inviteSent) {
        throw new Error(
          language === "vi"
            ? "Realtime dang mat ket noi"
            : "Realtime connection is unavailable",
        );
      }

      if (conversationType === "group") {
        const joinedSent = publishCallSignal(
          session.conversationId,
          null,
          session.callId,
          session.mode,
          "CALL_JOINED",
          {
            initiatorUserId,
            conversationType,
          },
        );

        if (!joinedSent) {
          throw new Error(
            language === "vi"
              ? "Khong the bat dau cuoc goi nhom"
              : "Cannot start group call",
          );
        }
      } else if (peerUserId) {
        // Wait for CALL_ACCEPT before creating SDP offer to avoid glare/race conditions.
      }

      transitionCallState("OUTGOING_START", callId);
      startOutgoingCallGuards(session);
      setActiveCall((prev) =>
        prev && prev.callId === callId
          ? {
              ...prev,
              status: "ringing",
              participantIds:
                prev.conversationType === "group"
                  ? prev.participantIds
                  : peerUserId
                    ? Array.from(new Set([...prev.participantIds, peerUserId]))
                    : prev.participantIds,
            }
          : prev,
      );
    } catch (error) {
      clearOutgoingCallGuards();
      transitionCallState("END", callId);
      updateCallHistoryStatus(callId, "missed");
      if (conversationType === "group") {
        clearGroupCallNotice(activeConversationId, callId);
      }
      resetCallRuntime();
      const detail = (error as { message?: string })?.message;
      setBannerMessage(detail || toApiErrorMessage(error));
    }
  };

  const onJoinGroupCallFromNotice = useCallback(
    async (notice: GroupCallNotice) => {
      if (activeCallRef.current) {
        setBannerMessage(
          language === "vi"
            ? "Hay ket thuc cuoc goi hien tai truoc khi tham gia"
            : "Please end current call before joining",
        );
        return;
      }

      const currentUserId = myUserIdRef.current;
      if (!currentUserId) {
        setBannerMessage(
          language === "vi"
            ? "Thong tin tai khoan chua san sang, vui long thu lai"
            : "Account context is not ready yet, please try again",
        );
        return;
      }

      const session: DirectCallSession = {
        callId: notice.callId,
        conversationId: notice.conversationId,
        conversationType: "group",
        initiatorUserId: notice.initiatorUserId,
        peerDisplayName: notice.initiatorDisplayName,
        mode: notice.mode,
        direction: "incoming",
        status: "connecting",
        startedAt: notice.createdAt,
        connectedAt: null,
        participantIds: [],
      };

      hasUserOpenedConversationRef.current = true;
      manuallyOpenedConversationIdRef.current = notice.conversationId;
      setActiveConversationId(notice.conversationId);
      setActiveTab("messages");
      setIncomingCall(null);

      transitionCallState("LOCAL_ACCEPTED", notice.callId);
      setActiveCall(session);

      appendCallHistory({
        id: session.callId,
        conversationId: session.conversationId,
        conversationName: session.peerDisplayName,
        mode: session.mode,
        direction: "incoming",
        status: "started",
        createdAt: new Date().toISOString(),
      });

      try {
        await acquireLocalStream(session.mode);

        const acceptSent = publishCallSignal(
          session.conversationId,
          session.initiatorUserId,
          session.callId,
          session.mode,
          "CALL_ACCEPT",
          {
            acceptedAt: new Date().toISOString(),
            initiatorUserId: session.initiatorUserId,
            conversationType: "group",
            joinedFromBanner: true,
          },
        );

        if (!acceptSent) {
          throw new Error(
            language === "vi"
              ? "Khong the tham gia cuoc goi khi realtime dang ngat"
              : "Cannot join call while realtime is disconnected",
          );
        }

        const joinedSent = publishCallSignal(
          session.conversationId,
          null,
          session.callId,
          session.mode,
          "CALL_JOINED",
          {
            initiatorUserId: session.initiatorUserId,
            conversationType: "group",
          },
        );

        if (!joinedSent) {
          throw new Error(
            language === "vi"
              ? "Khong the thong bao tham gia cuoc goi"
              : "Cannot announce joining the call",
          );
        }

        const offerSources = Object.keys(pendingOffersRef.current);
        for (const peerUserId of offerSources) {
          await processPendingOffer(session, peerUserId);
        }
      } catch (error) {
        publishCallSignal(
          session.conversationId,
          null,
          session.callId,
          session.mode,
          "CALL_LEAVE",
          {
            reason: "join_from_banner_failed",
            initiatorUserId: session.initiatorUserId,
            conversationType: "group",
          },
        );

        updateCallHistoryStatus(session.callId, "missed");
        resetCallRuntime();

        const detail = (error as { message?: string })?.message;
        setBannerMessage(detail || toApiErrorMessage(error));
      }
    },
    [
      acquireLocalStream,
      appendCallHistory,
      language,
      processPendingOffer,
      publishCallSignal,
      resetCallRuntime,
      setActiveConversationId,
      transitionCallState,
      updateCallHistoryStatus,
    ],
  );

  useEffect(() => {
    return () => {
      clearOutgoingCallGuards();
      clearGroupCallSoloGuard();
      callManagerRef.current.dispose();

      stopMediaStream(localCallStreamRef.current);
      Object.values(remoteCallStreamsRef.current).forEach((stream) => {
        stopMediaStream(stream);
      });

      Object.values(peerConnectionsRef.current).forEach((connection) => {
        connection.onicecandidate = null;
        connection.oniceconnectionstatechange = null;
        connection.ontrack = null;
        connection.onconnectionstatechange = null;
        connection.close();
      });
    };
  }, [clearGroupCallSoloGuard, clearOutgoingCallGuards]);

  const filteredConversations = useMemo(() => {
    const rawSearch = searchText.trim();
    const normalized = rawSearch.toLowerCase();
    const isPinUnlockQuery = Boolean(hiddenConversationPin && rawSearch === hiddenConversationPin);
    const visible = conversations.filter(
      (conversation) => isPinUnlockQuery || !groupPreferenceMap[conversation.id]?.hidden,
    );

    const base = isPinUnlockQuery
      ? visible
      : !normalized
      ? visible
      : visible.filter((conversation) => {
      const displayName = getConversationDisplayName(conversation);
      return (
        displayName.toLowerCase().includes(normalized) ||
        conversation.lastMessage.toLowerCase().includes(normalized)
      );
    });

    return [...base].sort((left, right) => {
      const leftPinned = Boolean(groupPreferenceMap[left.id]?.pinned);
      const rightPinned = Boolean(groupPreferenceMap[right.id]?.pinned);
      if (leftPinned !== rightPinned) {
        return Number(rightPinned) - Number(leftPinned);
      }
      const leftTime = left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0;
      const rightTime = right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0;
      return rightTime - leftTime;
    });
  }, [
    conversations,
    groupPreferenceMap,
    hiddenConversationPin,
    searchText,
    userProfileMap,
    myProfile?.id,
  ]);

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
        avatarUrl: resolveMediaUrl(conversation.avatar ?? null) ?? undefined,
        timestamp: conversation.lastMessageAt
          ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(conversation.lastMessageAt))
          : "--:--",
        lastMessage: formatConversationLastPreview(conversation),
        unreadCount: conversation.unreadCount ?? 0,
        isPinned: Boolean(groupPreferenceMap[conversation.id]?.pinned),
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
    groupPreferenceMap,
    myProfile?.id,
    formatConversationLastPreview,
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
    const inviteCode = (searchParams.get("groupInvite") ?? "").trim();
    if (!inviteCode || !myProfile?.id) {
      return;
    }
    if (joinInviteInProgressRef.current) {
      return;
    }
    if (processedInviteCodeRef.current === inviteCode) {
      return;
    }

    joinInviteInProgressRef.current = true;
    processedInviteCodeRef.current = inviteCode;

    const joinByLink = async () => {
      try {
        const result = await joinGroupByInviteCode(inviteCode);
        const joinedConversationId = result.data.id;
        const joinedAsMember = (result.data.participants ?? []).includes(myProfile.id);

        await fetchConversations({ silent: true });

        setActiveTab("messages");
        if (joinedAsMember) {
          hasUserOpenedConversationRef.current = true;
          manuallyOpenedConversationIdRef.current = joinedConversationId;
          pendingReadSyncOnOpenRef.current = true;
          setActiveConversationId(joinedConversationId);
          setBannerMessage(
            language === "vi"
              ? "Da tham gia nhom tu link moi"
              : "Joined group from invite link",
          );
        } else {
          setActiveConversationId(null);
          setBannerMessage(
            language === "vi"
              ? "Yeu cau tham gia nhom da duoc gui, vui long cho truong/pho nhom duyet"
              : "Join request submitted. Please wait for admin approval",
          );
        }
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      } finally {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("groupInvite");
        setSearchParams(nextParams, { replace: true });
        joinInviteInProgressRef.current = false;
      }
    };

    void joinByLink();
  }, [searchParams, setSearchParams, myProfile?.id, language]);

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
              ? "Khong the thu hoi tin nhan sau 5p"
              : "Cannot recall this message after 5 minutes",
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
          event.eventType === "user_typing_group" ||
          event.eventType === "USER_TYPING_GROUP";
        const isConversationSyncEvent =
          event.eventType === "CONVERSATION_UPDATED" ||
          event.eventType === "UNREAD_COUNT_UPDATED" ||
          event.eventType === "TOTAL_UNREAD_UPDATED" ||
          event.eventType === "group_created" ||
          event.eventType === "GROUP_CREATED";
        const isMessageEvent =
          event.eventType === "NEW_MESSAGE" ||
          event.eventType === "MESSAGE_SENT" ||
          event.eventType === "new_group_message" ||
          event.eventType === "message_replied" ||
          event.eventType === "NEW_GROUP_MESSAGE" ||
          event.eventType === "MESSAGE_REPLIED";

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
            const isGroupCreatedEvent =
              event.eventType === "group_created" ||
              event.eventType === "GROUP_CREATED";
            upsertConversation({
              id: event.conversationId,
              type: isGroupCreatedEvent ? "group" : undefined,
              name: isGroupCreatedEvent
                ? (language === "vi" ? "Nhom moi" : "New group")
                : undefined,
              lastMessage: event.lastMessage ?? undefined,
              lastMessageAt:
                event.lastMessageAt ??
                (isGroupCreatedEvent ? new Date().toISOString() : undefined),
              unreadCount: event.unreadCount ?? undefined,
            });

            const client = realtimeClientRef.current;
            const shouldSyncSubscriptions =
              !conversationIdsRef.current.includes(event.conversationId);
            if (client && client.isConnected() && shouldSyncSubscriptions) {
              client.syncConversationSubscriptions(
                Array.from(new Set([...conversationIdsRef.current, event.conversationId])),
              );
            }

            if (selectedConversationId === event.conversationId) {
              void refreshGroupSettings(event.conversationId);
            }
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
        if (
          event.eventType === "NEW_MESSAGE" ||
          event.eventType === "new_group_message" ||
          event.eventType === "NEW_GROUP_MESSAGE" ||
          event.eventType === "MESSAGE_REPLIED" ||
          event.eventType === "message_replied"
        ) {
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

          if (
            event.eventType === "READ_RECEIPT" &&
            event.actorId === myUserIdRef.current &&
            event.conversationId
          ) {
            lastReadSyncedMessageByConversationRef.current[event.conversationId] = normalizedMessage.id;
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
          lastMessageSenderId: normalizedMessage.senderId,
          lastMessageType: normalizedMessage.type ?? null,
          lastMessageAt: normalizedMessage.createdAt,
          unreadCount: unreadPatch,
        });

        if (event.conversationId) {
          const client = realtimeClientRef.current;
          const shouldSyncSubscriptions =
            !conversationIdsRef.current.includes(event.conversationId);
          if (client && client.isConnected() && shouldSyncSubscriptions) {
            client.syncConversationSubscriptions(
              Array.from(new Set([...conversationIdsRef.current, event.conversationId])),
            );
          }
        }
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
      onCallEvent: (event) => {
        handleCallEvent(event);
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

    const myUserId = myUserIdRef.current;
    const alreadySeenByMe = Boolean(
      myUserId && latestMessage?.seenBy?.includes(myUserId),
    );
    const lastSyncedMessageId =
      lastReadSyncedMessageByConversationRef.current[activeConversationId];
    const shouldSendReadSync =
      lastSyncedMessageId !== latestMessageId &&
      (!alreadySeenByMe || shouldSyncAfterManualOpen);

    markConversationReadLocal(activeConversationId);
    pendingReadSyncOnOpenRef.current = false;
    if (shouldSendReadSync) {
      void syncConversationReadState(activeConversationId, latestMessageId);
    }
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

      const myUserId = myUserIdRef.current;
      const alreadySeenByMe = Boolean(
        myUserId && latestMessage?.seenBy?.includes(myUserId),
      );
      const lastSyncedMessageId =
        lastReadSyncedMessageByConversationRef.current[
          activeConversationIdRef.current
        ];

      markConversationReadLocal(activeConversationIdRef.current);
      if (!alreadySeenByMe && lastSyncedMessageId !== latestMessageId) {
        void syncConversationReadState(activeConversationIdRef.current, latestMessageId);
      }
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

  const onQuickSendText = async (text: string) => {
    const content = text.trim();
    if (!content || !activeConversationId || isSending) {
      return;
    }

    onTypingSendMessage();

    try {
      setIsSending(true);
      const result = await sendMessage(activeConversationId, content, {
        type: "TEXT",
        parentMessageId: null,
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
    const mime = (file.type ?? "").toLowerCase();
    const mediaKind = inferMediaKind(file);

    const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "avif", "jfif"]);
    const videoExtensions = new Set(["mp4", "mov", "webm", "mkv", "avi"]);
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
      if (!imageExtensions.has(ext) && !mime.startsWith("image/")) {
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
      if (!videoExtensions.has(ext) && !mime.startsWith("video/")) {
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
    const content = caption || `Attachment: ${uploaded.data.fileName}`;
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
        lastMessageSenderId: myUserIdRef.current,
        lastMessageType: "TEXT",
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

  const onForwardMessages = async (messageIds: string[]) => {
    if (!activeConversationId) return;
    const normalizedMessageIds = Array.from(
      new Set(messageIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (normalizedMessageIds.length === 0) {
      return;
    }
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
    setForwardMessageIds(normalizedMessageIds);
    setIsForwardModalOpen(true);
  };

  const onForwardMessage = async (messageId: string) => {
    await onForwardMessages([messageId]);
  };

  const onConfirmForwardTargets = async ({
    targetConversationIds,
    targetUserIds,
  }: {
    targetConversationIds: string[];
    targetUserIds: string[];
  }) => {
    if (!activeConversationId || forwardMessageIds.length === 0) {
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

      const forwardOne = async (
        targetConversationId: string,
        sourceMessageId: string,
      ) => {
        await forwardMessage(
          activeConversationId,
          sourceMessageId,
          targetConversationId,
        );
        return { targetConversationId, sourceMessageId, channel: "rest" as const };
      };

      const results = await Promise.allSettled(
        uniqueTargetIds.flatMap((targetId) =>
          forwardMessageIds.map((messageId) => forwardOne(targetId, messageId)),
        ),
      );

      const successItems = results.filter(
        (item) => item.status === "fulfilled",
      ) as PromiseFulfilledResult<{
        targetConversationId: string;
        sourceMessageId: string;
        channel: "rest";
      }>[];
      const failedItems = results.filter(
        (item) => item.status === "rejected",
      ) as PromiseRejectedResult[];
      const successCount = successItems.length;
      const failedCount = failedItems.length;
      const restCount = successItems.length;
      const forwardedMessageCount = successItems.length;
      const forwardedTargetCount = uniqueTargetIds.length;

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
            ? `Da chuyen tiep ${forwardedMessageCount} tin nhan den ${forwardedTargetCount} doi tuong`
            : `Forwarded ${forwardedMessageCount} message(s) to ${forwardedTargetCount} target(s)`,
        );
      } else if (failedCount === 0 && restCount > 0) {
        setBannerMessage(
          language === "vi"
            ? `Da chuyen tiep ${forwardedMessageCount} tin nhan den ${forwardedTargetCount} doi tuong (${restCount} qua API)`
            : `Forwarded ${forwardedMessageCount} message(s) to ${forwardedTargetCount} target(s) (${restCount} via API)`,
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
      setForwardMessageIds([]);
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
      const createdConversation = response.data;
      const createdConversationId = createdConversation.id;

      // Optimistically add newly created group so it appears immediately in sidebar.
      upsertConversation({
        id: createdConversationId,
        type: createdConversation.type ?? "group",
        name: createdConversation.name || name,
        avatar: createdConversation.avatar ?? null,
        lastMessage: createdConversation.lastMessage ?? "",
        lastMessageAt:
          createdConversation.lastMessageAt ?? new Date().toISOString(),
        unreadCount: createdConversation.unreadCount ?? 0,
        participants: createdConversation.participants ?? [],
        admins: createdConversation.admins ?? [],
        ownerId: createdConversation.ownerId ?? null,
      });

      const client = realtimeClientRef.current;
      if (client && client.isConnected()) {
        client.syncConversationSubscriptions(
          Array.from(new Set([...conversationIdsRef.current, createdConversationId])),
        );
      }

      void fetchConversations({ silent: true });
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

  const onSaveHiddenConversationPin = () => {
    const nextPin = settingsPinDraft.trim();
    const confirmPin = settingsPinConfirmDraft.trim();

    if (!isValidConversationPin(nextPin)) {
      setBannerMessage(
        language === "vi"
          ? "PIN phai gom 4 den 8 chu so"
          : "PIN must contain 4 to 8 digits",
      );
      return;
    }

    if (nextPin !== confirmPin) {
      setBannerMessage(
        language === "vi" ? "PIN xac nhan khong khop" : "PIN confirmation does not match",
      );
      return;
    }

    setHiddenConversationPin(nextPin);
    persistHiddenConversationPin(nextPin);
    setSettingsPinDraft("");
    setSettingsPinConfirmDraft("");
    setBannerMessage(
      language === "vi" ? "Da cap nhat ma PIN an chat" : "Hidden-chat PIN updated",
    );
  };

  const onRemoveHiddenConversationPin = () => {
    if (!hiddenConversationPin) {
      return;
    }

    const enteredPin =
      window.prompt(
        language === "vi"
          ? "Nhap ma PIN hien tai de xoa"
          : "Enter current PIN to remove it",
      ) ?? "";

    if (enteredPin.trim() !== hiddenConversationPin) {
      setBannerMessage(language === "vi" ? "Sai ma PIN" : "Incorrect PIN");
      return;
    }

    setHiddenConversationPin(null);
    persistHiddenConversationPin(null);
    setGroupPreferenceMap((prev) => {
      let changed = false;
      const next: Record<string, GroupPreferenceItem> = {};

      Object.entries(prev).forEach(([conversationId, value]) => {
        if (value.hidden) {
          changed = true;
          next[conversationId] = {
            ...value,
            hidden: false,
          };
        } else {
          next[conversationId] = value;
        }
      });

      return changed ? next : prev;
    });
    setSettingsPinDraft("");
    setSettingsPinConfirmDraft("");
    setBannerMessage(language === "vi" ? "Da xoa ma PIN an chat" : "Hidden-chat PIN removed");
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
  const globalUnreadCount = Math.max(totalUnreadCount, unreadFromConversations);
  const messageBadge = globalUnreadCount > 0 ? globalUnreadCount : 0;
  const contactsBadge =
    pendingFriendRequestsUnreadCount > 0
      ? Math.min(pendingFriendRequestsUnreadCount, 99)
      : 0;

  const activeConversationForView = activeConversation
    ? {
      ...activeConversation,
      name: getConversationDisplayName(activeConversation),
    }
    : null;

  const activeConversationPinned = activeConversationForView
    ? Boolean(groupPreferenceMap[activeConversationForView.id]?.pinned)
    : false;

  const activePinnedBoardItems = useMemo(() => {
    if (activeConversationForView?.type !== "group") {
      return [] as PinnedBoardItem[];
    }

    const pinnedBySource = new Map<string, PinnedBoardItem>();

    const settingsPinnedMessages =
      activeConversationForView?.type === "group"
        ? groupSettingsMap[activeConversationForView.id]?.pinnedMessages ?? []
        : [];

    for (const item of settingsPinnedMessages) {
      const sourceMessageId = String(item.sourceMessageId ?? "").trim();
      if (!sourceMessageId) {
        continue;
      }
      pinnedBySource.set(sourceMessageId, {
        id: `pin-${sourceMessageId}`,
        itemType: "pin",
        sourceMessageId,
        title: String(item.title ?? "").trim() || (language === "vi" ? "Tin nhan da ghim" : "Pinned message"),
        preview: String(item.preview ?? "").trim(),
        createdAtMs: Number.isFinite(item.createdAtMs) ? item.createdAtMs : 0,
      });
    }

    const orderedEvents = messages
      .map((item) => parsePinBoardEvent(item))
      .filter((item): item is PinBoardEvent => Boolean(item))
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const event of orderedEvents) {
      if (!event.pinToTop) {
        pinnedBySource.delete(event.sourceMessageId);
        continue;
      }

      pinnedBySource.set(event.sourceMessageId, {
        id: event.id,
        itemType: event.itemType,
        sourceMessageId: event.sourceMessageId,
        title: event.title,
        preview: event.preview,
        createdAtMs: event.createdAtMs,
      });
    }

    return Array.from(pinnedBySource.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [messages, activeConversationForView?.id, activeConversationForView?.type, groupSettingsMap, language]);

  const latestPinnedSummary = useMemo(() => {
    const latest = activePinnedBoardItems[0];
    if (!latest) {
      return null;
    }

    return {
      itemType: latest.itemType,
      title: latest.title,
      preview: latest.preview,
      sourceMessageId: latest.sourceMessageId,
      count: activePinnedBoardItems.length,
    };
  }, [activePinnedBoardItems]);

  const headerUnreadBadgeCount = activeConversationForView
    ? Math.max(Math.max(0, activeConversationForView.unreadCount ?? 0), globalUnreadCount)
    : globalUnreadCount;

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

  const remoteCallStreamList = useMemo(() => Object.values(remoteCallStreams), [remoteCallStreams]);

  const activeGroupMembers = activeConversationForView?.type === "group"
    ? activeConversationForView.participants ?? []
    : [];

  const activeGroupPendingMembers = activeConversationForView?.type === "group"
    ? groupSettingsMap[activeConversationForView.id]?.pendingParticipants ?? []
    : [];

  const activeGroupSettings =
    activeConversationForView?.type === "group"
      ? groupSettingsMap[activeConversationForView.id] ?? null
      : null;

  const canComposeInActiveConversation = activeConversationForView?.type === "group"
    ? !activeGroupSettings?.onlyAdminsCanMessage ||
      Boolean(activeGroupSettings?.isOwner || activeGroupSettings?.isAdmin)
    : true;

  const composeBlockedMessage = activeConversationForView?.type === "group" && !canComposeInActiveConversation
    ? language === "vi"
      ? "Chỉ trưởng nhóm và phó nhóm được gửi tin nhắn vào nhóm này"
      : "Only the owner and admins can send messages in this group"
    : null;

  const activeGroupPreference =
    activeConversationForView?.type === "group"
      ? groupPreferenceMap[activeConversationForView.id] ?? {
          muted: false,
          pinned: false,
          hidden: false,
        }
      : {
          muted: false,
          pinned: false,
          hidden: false,
        };

  const typingDisplayName = typingUserId
    ? userProfileMap[typingUserId]?.fullName ?? typingUserId
    : null;

  const activeCallView: ActiveCallView | null = activeCall
    ? {
      callId: activeCall.callId,
      peerDisplayName: activeCall.peerDisplayName,
      mode: activeCall.mode,
      status: activeCall.status,
      startedAt: activeCall.startedAt,
      connectedAt: activeCall.connectedAt,
    }
    : null;

  const activeGroupCallNotice =
    activeConversationForView?.type === "group"
      ? groupCallNoticeMap[activeConversationForView.id] ?? null
      : null;

  const showJoinGroupCallNotice = Boolean(
    activeGroupCallNotice &&
      (!activeCall || activeCall.callId !== activeGroupCallNotice.callId),
  );

  const incomingCallView: IncomingCallView | null = incomingCall
    ? {
      callId: incomingCall.callId,
      peerDisplayName: incomingCall.peerDisplayName,
      mode: incomingCall.mode,
    }
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1521] text-slate-100">
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
        onAddFriend={() => setIsAddFriendOpen(true)}
        onCreateGroup={() => setIsCreateGroupOpen(true)}
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
            <div className="h-full overflow-y-auto p-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800">
                  {language === "vi" ? "Cuoc goi" : "Calls"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {language === "vi"
                    ? "Bat dau cuoc goi thoai/video truc tiep ngay trong ung dung."
                    : "Start voice/video calls directly inside the app."}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!activeConversationForView}
                    onClick={() => {
                      void onStartQuickCall("voice");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {language === "vi" ? "Goi thoai" : "Voice call"}
                  </button>
                  <button
                    type="button"
                    disabled={!activeConversationForView}
                    onClick={() => {
                      void onStartQuickCall("video");
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {language === "vi" ? "Goi video" : "Video call"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  {language === "vi" ? "Lich su cuoc goi" : "Recent calls"}
                </h3>

                {callHistory.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {language === "vi"
                      ? "Chua co cuoc goi nao trong phien nay."
                      : "No calls in this session yet."}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {callHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-700">
                            {item.mode === "video"
                              ? language === "vi"
                                ? "Goi video"
                                : "Video call"
                              : language === "vi"
                                ? "Goi thoai"
                                : "Voice call"}{" "}
                            · {item.conversationName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(item.createdAt).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {item.status === "connected"
                            ? language === "vi"
                              ? "Da ket noi"
                              : "Connected"
                            : item.status === "rejected"
                              ? language === "vi"
                                ? "Bi tu choi"
                                : "Declined"
                              : item.status === "missed"
                                ? language === "vi"
                                  ? "Nho"
                                  : "Missed"
                                : item.status === "ended"
                                  ? language === "vi"
                                    ? "Da ket thuc"
                                    : "Ended"
                                  : language === "vi"
                                    ? "Dang goi"
                                    : "Calling"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  {language === "vi" ? "Ma PIN an cuoc tro chuyen" : "Hidden conversation PIN"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {language === "vi"
                    ? hiddenConversationPin
                      ? "Nhap PIN trong o Search de hien lai cuoc tro chuyen da an"
                      : "Tao PIN de bat buoc bao ve khi an chat"
                    : hiddenConversationPin
                      ? "Enter this PIN in Search to reveal hidden conversations"
                      : "Create a PIN to protect hidden conversations"}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={settingsPinDraft}
                    onChange={(event) => setSettingsPinDraft(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder={language === "vi" ? "PIN moi (4-8 so)" : "New PIN (4-8 digits)"}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={settingsPinConfirmDraft}
                    onChange={(event) => setSettingsPinConfirmDraft(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder={language === "vi" ? "Nhap lai PIN" : "Confirm PIN"}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onSaveHiddenConversationPin}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    {hiddenConversationPin
                      ? language === "vi"
                        ? "Doi PIN"
                        : "Change PIN"
                      : language === "vi"
                        ? "Tao PIN"
                        : "Create PIN"}
                  </button>

                  {hiddenConversationPin && (
                    <button
                      type="button"
                      onClick={onRemoveHiddenConversationPin}
                      className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      {language === "vi" ? "Xoa PIN" : "Remove PIN"}
                    </button>
                  )}
                </div>
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

      <main className="min-w-0 flex-1 bg-[#0f1724]">
        {activeTab === "messages" ? (
          <section className="relative flex h-full flex-col overflow-hidden">
            {showJoinGroupCallNotice && activeGroupCallNotice && (
              <div className="z-20 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-emerald-100">
                    {language === "vi"
                      ? `${activeGroupCallNotice.initiatorDisplayName} dang trong cuoc goi ${
                          activeGroupCallNotice.mode === "video" ? "video" : "thoai"
                        } nhom`
                      : `${activeGroupCallNotice.initiatorDisplayName} is in an active ${
                          activeGroupCallNotice.mode === "video" ? "video" : "voice"
                        } group call`}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void onJoinGroupCallFromNotice(activeGroupCallNotice);
                    }}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
                  >
                    {language === "vi" ? "Tham gia cuoc goi" : "Join call"}
                  </button>
                </div>
              </div>
            )}

            {activeConversationForView?.type === "group" ? (
              <GroupChat
                language={language}
                conversation={activeConversationForView}
                isPanelOpen={isGroupPanelOpen}
                members={activeGroupMembers}
                pendingMembers={activeGroupPendingMembers}
                friendContacts={friendContacts}
                pinnedMessages={activePinnedBoardItems}
                onOpenPinnedMessage={(sourceMessageId: string) => {
                  setScrollToMessageRequest({ messageId: sourceMessageId, nonce: Date.now() });
                }}
                onForwardMessage={(messageId: string) => {
                  void onForwardMessage(messageId);
                }}
                onDeleteMessageForMe={(messageId: string) => {
                  void onDeleteForMe(messageId);
                }}
                onUnpinPinnedMessage={(sourceMessageId: string) => {
                  void onUnpinGroupMessage(sourceMessageId);
                }}
                onCreateBoardNote={(noteText: string, pinToTop: boolean) => {
                  void onCreateGroupBoardNote(noteText, pinToTop);
                }}
                onCreatePoll={(input: CreateGroupPollInput) => {
                  return onCreateGroupPoll(input);
                }}
                onCreateReminder={(input: { title: string; when?: string | null }) => {
                  return onCreateGroupReminder(input);
                }}
                userProfileMap={userProfileMap}
                messages={messages}
                currentUserId={myProfile?.id ?? null}
                settings={activeGroupSettings}
                preferences={activeGroupPreference}
                onRefreshSettings={() => {
                  if (activeConversationForView?.id) {
                    void refreshGroupSettings(activeConversationForView.id);
                  }
                }}
                onUpdateSettings={(payload: {
                  name?: string;
                  avatar?: string | null;
                  onlyAdminsCanMessage?: boolean;
                  requireApprovalToJoin?: boolean;
                  allowMemberInvite?: boolean;
                  allowMemberEditGroupInfo?: boolean;
                  allowMemberPinBoardItems?: boolean;
                  allowMemberCreateNotes?: boolean;
                  allowMemberCreateReminders?: boolean;
                  allowMemberCreatePolls?: boolean;
                  transferOwnerId?: string;
                }) => {
                  void onUpdateActiveGroupSettings(payload);
                }}
                onAddMembers={(userIds: string[]) => {
                  return onAddGroupMembers(userIds);
                }}
                isAddingMembers={isAddingGroupMembers}
                onSaveGroupName={(nextName: string) => {
                  return onSaveActiveGroupName(nextName);
                }}
                onSelectGroupAvatar={(file: File | null) => {
                  return onSelectActiveGroupAvatar(file);
                }}
                onClearGroupAvatar={() => {
                  return onClearActiveGroupAvatar();
                }}
                isUpdatingGroupProfile={isUpdatingGroupProfile}
                onRemoveMember={(userId: string) => {
                  void onRemoveGroupMember(userId);
                }}
                onApprovePendingMember={(userId: string) => {
                  void onApprovePendingGroupMember(userId);
                }}
                onRejectPendingMember={(userId: string) => {
                  void onRejectPendingGroupMember(userId);
                }}
                onToggleAdmin={(userId: string, admin: boolean) => {
                  void onToggleGroupAdmin(userId, admin);
                }}
                onMentionMember={onMentionGroupMember}
                onLeaveGroup={() => {
                  void onLeaveActiveGroup();
                }}
                onDeleteGroup={() => {
                  void onDeleteActiveGroup();
                }}
                onPreferenceChange={(patch: { muted?: boolean; pinned?: boolean; hidden?: boolean }) => {
                  if (activeConversationForView?.id) {
                    updateGroupPreference(activeConversationForView.id, patch);
                  }
                }}
                onSendTemplateMessage={(type:
                  | "STICKER"
                  | "GIF"
                  | "CONTACT"
                  | "LOCATION"
                  | "POLL"
                  | "REMINDER"
                  | "NOTE"
                  | "MEETING") => {
                  void onSendGroupTemplateMessage(type);
                }}
              >
                <Chat
                  language={language}
                  activeConversation={activeConversationForView}
                  activeConversationOnline={false}
                  activeConversationPresenceLabel={`${activeGroupMembers.length} ${language === "vi" ? "thanh vien" : "members"}`}
                  activeConversationPinned={activeConversationPinned}
                  headerUnreadBadgeCount={headerUnreadBadgeCount}
                  userProfileMap={userProfileMap}
                  showGroupPanelToggle
                  isGroupPanelOpen={isGroupPanelOpen}
                  onToggleGroupPanel={() => {
                    setIsGroupPanelOpen((prev) => !prev);
                  }}
                  messages={messages}
                  myProfile={myProfile}
                  isLoadingMessages={isLoadingMessages}
                  draftMessage={draftMessage}
                  onDraftChange={(value) => {
                    setDraftMessage(value);
                    onTypingTextChange(value);
                  }}
                  onVoiceCall={() => {
                    void onStartQuickCall("voice");
                  }}
                  onVideoCall={() => {
                    void onStartQuickCall("video");
                  }}
                  onSendMessage={onSendMessage}
                  onQuickSendText={onQuickSendText}
                  onSendFiles={onSendFiles}
                  onEditMessage={onEditMessage}
                  onRecallMessage={onRecallMessage}
                  onDeleteForMe={onDeleteForMe}
                  onForwardMessage={onForwardMessage}
                  onForwardMessages={onForwardMessages}
                  onReactMessage={onReactMessage}
                  onPinMessage={(targetMessage) => {
                    void onPinGroupMessage(targetMessage);
                  }}
                  onUnpinMessage={(targetMessage) => {
                    void onUnpinGroupMessage(targetMessage.id);
                  }}
                  canPinMessages={Boolean(activeGroupSettings?.isOwner || activeGroupSettings?.isAdmin || activeGroupSettings?.allowMemberPinBoardItems)}
                  onVotePollMessage={(targetMessage, optionId) => {
                    void onVoteGroupPoll(targetMessage, optionId);
                  }}
                  onClosePollMessage={(targetMessage) => {
                    void onCloseGroupPoll(targetMessage);
                  }}
                  canCompose={canComposeInActiveConversation}
                  composeBlockedMessage={composeBlockedMessage}
                  canManageGroupPoll={Boolean(activeGroupSettings?.isOwner || activeGroupSettings?.isAdmin)}
                  pinnedMessages={activePinnedBoardItems}
                  latestPinnedSummary={latestPinnedSummary}
                  scrollToMessageRequest={scrollToMessageRequest}
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
                activeConversationPinned={activeConversationPinned}
                headerUnreadBadgeCount={headerUnreadBadgeCount}
                userProfileMap={userProfileMap}
                messages={messages}
                myProfile={myProfile}
                isLoadingMessages={isLoadingMessages}
                draftMessage={draftMessage}
                onDraftChange={(value) => {
                  setDraftMessage(value);
                  // Use debounced typing indicator
                  onTypingTextChange(value);
                }}
                onVoiceCall={() => {
                  void onStartQuickCall("voice");
                }}
                onVideoCall={() => {
                  void onStartQuickCall("video");
                }}
                onSendMessage={onSendMessage}
                onQuickSendText={onQuickSendText}
                onSendFiles={onSendFiles}
                onEditMessage={onEditMessage}
                onRecallMessage={onRecallMessage}
                onDeleteForMe={onDeleteForMe}
                onForwardMessage={onForwardMessage}
                onForwardMessages={onForwardMessages}
                onReactMessage={onReactMessage}
                onVotePollMessage={undefined}
                onClosePollMessage={undefined}
                canCompose
                canManageGroupPoll={false}
                pinnedMessages={[]}
                latestPinnedSummary={null}
                scrollToMessageRequest={null}
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
          setForwardMessageIds([]);
        }}
        onConfirm={onConfirmForwardTargets}
      />

      <InAppCallOverlay
        language={language}
        incomingCall={incomingCallView}
        activeCall={activeCallView}
        localStream={localCallStream}
        remoteStreams={remoteCallStreamList}
        microphoneEnabled={isMicrophoneEnabled}
        cameraEnabled={isCameraEnabled}
        onAcceptIncoming={() => {
          void onAcceptIncomingCall();
        }}
        onRejectIncoming={onRejectIncomingCall}
        onEndCall={() => {
          onEndDirectCall("manual_end", true);
        }}
        onToggleMicrophone={onToggleMicrophone}
        onToggleCamera={onToggleCamera}
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
