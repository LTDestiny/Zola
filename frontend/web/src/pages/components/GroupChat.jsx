import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  BellOff,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Link as LinkIcon,
  MoreHorizontal,
  Newspaper,
  Pin,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { resolveMediaUrl } from "../utils/mediaUrl";

function initials(name) {
  const parts = (name || "").split(" ").filter(Boolean);
  if (parts.length === 0) return "G";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractLinks(text) {
  const matches = String(text ?? "").match(/https?:\/\/[^\s]+/g);
  return matches ?? [];
}

function formatShortDate(value) {
  if (!value) return "--/--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}`;
}

function toDomain(link) {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}

function Section({ title, open, onToggle, children }) {
  return (
    <section className="rounded-2xl border border-[#2a4b73] bg-[#0f294a]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <span className="text-lg font-semibold text-slate-100">{title}</span>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>
      {open && <div className="border-t border-slate-700 px-3 py-3">{children}</div>}
    </section>
  );
}

export function GroupChat({
  language,
  conversation,
  isPanelOpen = true,
  members,
  pendingMembers,
  friendContacts,
  pinnedMessages,
  onOpenPinnedMessage,
  onUnpinPinnedMessage,
  onCreateBoardNote,
  onCreatePoll,
  onCreateReminder,
  userProfileMap,
  messages,
  currentUserId,
  settings,
  preferences,
  onRefreshSettings,
  onUpdateSettings,
  onAddMembers,
  isAddingMembers,
  onSaveGroupName,
  onSelectGroupAvatar,
  onClearGroupAvatar,
  isUpdatingGroupProfile,
  onRemoveMember,
  onApprovePendingMember,
  onRejectPendingMember,
  onToggleAdmin,
  onMentionMember,
  onLeaveGroup,
  onDeleteGroup,
  onPreferenceChange,
  onSendTemplateMessage,
  onClosePanel,
  children,
}) {
  const safeMembers = members ?? [];
  const safePendingMembers = pendingMembers ?? [];
  const safeFriendContacts = friendContacts ?? [];
  const safePinnedMessages = pinnedMessages ?? [];
  const safeMessages = messages ?? [];

  const [nameDraft, setNameDraft] = useState(conversation?.name ?? "");
  const [searchText, setSearchText] = useState("");
  const [isHeaderEditOpen, setIsHeaderEditOpen] = useState(false);
  const [memberPickerSearch, setMemberPickerSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isNotePinnedToTop, setIsNotePinnedToTop] = useState(true);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [pollQuestionDraft, setPollQuestionDraft] = useState("");
  const [pollOptionDrafts, setPollOptionDrafts] = useState(["", ""]);
  const [isPollMultiChoice, setIsPollMultiChoice] = useState(false);
  const [isPollAllowChangeVote, setIsPollAllowChangeVote] = useState(true);
  const [pollDeadlineMinutes, setPollDeadlineMinutes] = useState(1440);
  const [isPollHideResultsBeforeVote, setIsPollHideResultsBeforeVote] = useState(false);
  const [isCreateReminderOpen, setIsCreateReminderOpen] = useState(false);
  const [reminderTitleDraft, setReminderTitleDraft] = useState("");
  const [reminderTimeDraft, setReminderTimeDraft] = useState("");
  const [manageMode, setManageMode] = useState(false);
  const [panelView, setPanelView] = useState("default");
  const [boardTab, setBoardTab] = useState("all");
  const [archiveTab, setArchiveTab] = useState("media");
  const [archiveSenderFilter, setArchiveSenderFilter] = useState("all");
  const [archiveDateFilter, setArchiveDateFilter] = useState("all");
  const [activeMemberActionId, setActiveMemberActionId] = useState(null);
  const [activeMemberActionDirection, setActiveMemberActionDirection] = useState("down");
  const [openSections, setOpenSections] = useState({
    members: true,
    board: true,
    media: true,
    files: true,
    links: true,
    security: true,
    manage: true,
    memberList: true,
  });
  const [memberPermissionMap, setMemberPermissionMap] = useState({
    renameGroup: false,
    pinBoardItems: false,
    createNote: false,
    createReminder: false,
    createPoll: false,
    sendMessage: true,
  });
  const avatarInputRef = useRef(null);
  const memberListScrollRef = useRef(null);
  const memberActionButtonRefs = useRef({});

  useEffect(() => {
    setNameDraft(conversation?.name ?? "");
    setManageMode(false);
    setPanelView("default");
    setBoardTab("all");
    setArchiveTab("media");
    setArchiveSenderFilter("all");
    setArchiveDateFilter("all");
    setActiveMemberActionId(null);
    setActiveMemberActionDirection("down");
    setIsHeaderEditOpen(false);
    setIsCreateNoteOpen(false);
    setIsCreatePollOpen(false);
    setIsCreateReminderOpen(false);
  }, [conversation?.id, conversation?.name, conversation?.avatar]);

  const ownerId = settings?.ownerId ?? conversation?.ownerId ?? null;
  const adminIds = settings?.admins ?? conversation?.admins ?? [];
  const isOwner = Boolean(
    settings?.isOwner ?? (currentUserId && ownerId && currentUserId === ownerId),
  );
  const isAdmin = Boolean(settings?.isAdmin ?? (currentUserId && adminIds.includes(currentUserId)));
  const canOpenManage = isOwner || isAdmin;
  const canInviteMembers = canOpenManage || Boolean(settings?.allowMemberInvite);
  const canEditSecuritySettings = canOpenManage;
  const canEditGroupProfile = canOpenManage || Boolean(settings?.allowMemberEditGroupInfo);
  const canPinBoardItems = canOpenManage || Boolean(settings?.allowMemberPinBoardItems);
  const canCreateNotes = canOpenManage || Boolean(settings?.allowMemberCreateNotes);
  const canCreateReminders = canOpenManage || Boolean(settings?.allowMemberCreateReminders);
  const canCreatePolls = canOpenManage || Boolean(settings?.allowMemberCreatePolls);
  const resolvedConversationAvatar = resolveMediaUrl(conversation?.avatar ?? null);

  useEffect(() => {
    setMemberPermissionMap((prev) => ({
      ...prev,
      renameGroup: Boolean(settings?.allowMemberEditGroupInfo),
      pinBoardItems: Boolean(settings?.allowMemberPinBoardItems),
      createNote: Boolean(settings?.allowMemberCreateNotes),
      createReminder: Boolean(settings?.allowMemberCreateReminders),
      createPoll: Boolean(settings?.allowMemberCreatePolls),
      sendMessage: !Boolean(settings?.onlyAdminsCanMessage),
    }));
  }, [
    settings?.allowMemberEditGroupInfo,
    settings?.allowMemberPinBoardItems,
    settings?.allowMemberCreateNotes,
    settings?.allowMemberCreateReminders,
    settings?.allowMemberCreatePolls,
    settings?.onlyAdminsCanMessage,
  ]);

  useEffect(() => {
    const closeMemberActionMenu = () => {
      setActiveMemberActionId(null);
      setActiveMemberActionDirection("down");
    };
    document.addEventListener("click", closeMemberActionMenu);
    return () => {
      document.removeEventListener("click", closeMemberActionMenu);
    };
  }, []);

  const openMemberActionMenu = (memberId) => {
    const trigger = memberActionButtonRefs.current[memberId];
    const container = memberListScrollRef.current;
    let nextDirection = "down";

    if (trigger && container) {
      const triggerRect = trigger.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const estimatedMenuHeight = 132;
      const spaceBelow = containerRect.bottom - triggerRect.bottom;
      const spaceAbove = triggerRect.top - containerRect.top;

      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        nextDirection = "up";
      }
    }

    setActiveMemberActionDirection(nextDirection);
    setActiveMemberActionId((prev) => (prev === memberId ? null : memberId));
  };

  const parsedMessages = useMemo(() => {
    return safeMessages
      .map((message) => {
        const type = String(message.type ?? "TEXT").toUpperCase();
        const json = tryParseJson(message.content ?? "");
        const createdAt = message.createdAt ? Date.parse(message.createdAt) : 0;
        return {
          ...message,
          type,
          json,
          createdAtMs: Number.isFinite(createdAt) ? createdAt : 0,
          links: extractLinks(message.content ?? ""),
          resolvedFileUrl: resolveMediaUrl(message.fileUrl ?? null),
        };
      })
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }, [safeMessages]);

  const filteredMembers = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return safeMembers;
    }
    return safeMembers.filter((memberId) => {
      const profile = userProfileMap?.[memberId];
      const name = String(profile?.fullName ?? memberId).toLowerCase();
      return name.includes(normalized) || memberId.toLowerCase().includes(normalized);
    });
  }, [safeMembers, searchText, userProfileMap]);

  const filteredPendingMembers = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return safePendingMembers;
    }
    return safePendingMembers.filter((item) => {
      const memberId = String(item?.userId ?? "");
      const profile = userProfileMap?.[memberId];
      const name = String(profile?.fullName ?? memberId).toLowerCase();
      return name.includes(normalized) || memberId.toLowerCase().includes(normalized);
    });
  }, [safePendingMembers, searchText, userProfileMap]);

  const addableFriendCandidates = useMemo(() => {
    const memberSet = new Set(safeMembers);
    const pendingMemberSet = new Set(
      safePendingMembers
        .map((item) => String(item?.userId ?? "").trim())
        .filter(Boolean),
    );
    const myId = currentUserId ?? null;
    const normalized = memberPickerSearch.trim().toLowerCase();

    return safeFriendContacts
      .map((friend, index) => {
        const profile = userProfileMap?.[friend.userId];
        const displayName = profile?.fullName ?? `User ${friend.userId.slice(0, 8)}`;
        const email = profile?.email ?? "";
        return {
          userId: friend.userId,
          displayName,
          email,
          avatarUrl: profile?.avatarUrl ?? null,
          sortKey: `${displayName}-${friend.userId}-${index}`,
        };
      })
      .filter((candidate) => candidate.userId && candidate.userId !== myId)
      .filter((candidate) => !memberSet.has(candidate.userId))
      .filter((candidate) => !pendingMemberSet.has(candidate.userId))
      .filter((candidate) => {
        if (!normalized) {
          return true;
        }
        const name = candidate.displayName.toLowerCase();
        const email = candidate.email.toLowerCase();
        const id = candidate.userId.toLowerCase();
        return (
          name.includes(normalized) ||
          email.includes(normalized) ||
          id.includes(normalized)
        );
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [safeFriendContacts, safeMembers, safePendingMembers, currentUserId, memberPickerSearch, userProfileMap]);

  const mediaItems = useMemo(() => {
    return parsedMessages
      .filter((item) => {
        if (!item.resolvedFileUrl) return false;
        if (item.type === "IMAGE" || item.type === "VIDEO" || item.type === "GIF") {
          return true;
        }
        const fileName = String(item.fileName ?? "").toLowerCase();
        return /(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);
      });
  }, [parsedMessages]);

  const fileItems = useMemo(() => {
    return parsedMessages
      .filter((item) => {
        if (!item.resolvedFileUrl) return false;
        if (item.type === "FILE") return true;
        const fileName = String(item.fileName ?? "").toLowerCase();
        return !/(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);
      });
  }, [parsedMessages]);

  const linkItems = useMemo(() => {
    const bucket = [];
    parsedMessages.forEach((item) => {
      item.links.forEach((link) => {
        bucket.push({
          id: `${item.id}-${link}`,
          senderId: item.senderId,
          link,
          createdAt: item.createdAt,
        });
      });
    });
    return bucket;
  }, [parsedMessages]);

  const previewMediaItems = useMemo(() => mediaItems.slice(0, 8), [mediaItems]);
  const previewFileItems = useMemo(() => fileItems.slice(0, 3), [fileItems]);
  const previewLinkItems = useMemo(() => linkItems.slice(0, 3), [linkItems]);

  const reminderItems = useMemo(() => {
    return parsedMessages
      .filter((item) => item.type === "REMINDER")
      .map((item) => {
        const title = String(item.json?.title ?? item.content ?? "").trim();
        const eventTime = String(item.json?.when ?? item.json?.eventTime ?? item.createdAt ?? "");
        return {
          id: item.id,
          title: title || (language === "vi" ? "Nhac hen" : "Reminder"),
          eventTime,
          createdAtMs: item.createdAtMs,
        };
      })
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }, [parsedMessages, language]);

  const boardFeedItems = useMemo(() => {
    const pinnedItems = safePinnedMessages.map((item) => ({
      id: `pin-${item.id}`,
      sourceId: item.sourceMessageId,
      createdAtMs: item.createdAtMs,
      createdAt: new Date(item.createdAtMs || Date.now()).toISOString(),
      title: item.title,
      preview: item.preview,
      itemType: item.itemType,
      senderId: null,
    }));

    const noteItems = parsedMessages
      .filter((item) => item.type === "NOTE")
      .filter((item) => {
        const kind = String(item.json?.kind ?? "").toUpperCase();
        return kind === "BOARD_NOTE";
      })
      .map((item) => ({
        id: `note-${item.id}`,
        sourceId: item.id,
        createdAtMs: item.createdAtMs,
        createdAt: item.createdAt,
        title: String(item.json?.title ?? (language === "vi" ? "Ghi chu nhom" : "Group note")),
        preview: String(item.json?.note ?? item.json?.preview ?? item.content ?? ""),
        itemType: "note",
        senderId: item.senderId ?? null,
      }));

    const pollItems = parsedMessages
      .filter((item) => item.type === "POLL")
      .filter((item) => String(item.json?.kind ?? "").toUpperCase() === "GROUP_POLL")
      .map((item) => ({
        id: `poll-${item.id}`,
        sourceId: item.id,
        createdAtMs: item.createdAtMs,
        createdAt: item.createdAt,
        title: String(item.json?.question ?? item.json?.title ?? (language === "vi" ? "Binh chon" : "Poll")),
        preview: Array.isArray(item.json?.options)
          ? `${item.json.options.length} ${language === "vi" ? "lua chon" : "options"}`
          : "",
        itemType: "poll",
        senderId: item.senderId ?? null,
      }));

    return [...pinnedItems, ...noteItems, ...pollItems].sort(
      (left, right) => right.createdAtMs - left.createdAtMs,
    );
  }, [safePinnedMessages, parsedMessages, language]);

  const boardItemsForView = useMemo(() => {
    if (boardTab === "all") {
      return boardFeedItems;
    }
    if (boardTab === "pins") {
      return boardFeedItems.filter((item) => item.itemType === "pin");
    }
    if (boardTab === "notes") {
      return boardFeedItems.filter((item) => item.itemType === "note");
    }
    return boardFeedItems.filter((item) => item.itemType === "poll");
  }, [boardFeedItems, boardTab]);

  const archiveSenderOptions = useMemo(() => {
    const senderIds = new Set();
    [...mediaItems, ...fileItems, ...linkItems].forEach((item) => {
      if (item.senderId) {
        senderIds.add(item.senderId);
      }
    });
    return Array.from(senderIds);
  }, [mediaItems, fileItems, linkItems]);

  const archiveDateOptions = useMemo(() => {
    const dateKeys = new Set();
    [...mediaItems, ...fileItems, ...linkItems].forEach((item) => {
      const sourceDate = item.createdAt ? new Date(item.createdAt) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
        return;
      }
      const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
      dateKeys.add(key);
    });
    return Array.from(dateKeys).sort((left, right) => (left < right ? 1 : -1));
  }, [mediaItems, fileItems, linkItems]);

  const applyArchiveFilters = (items) => {
    return items.filter((item) => {
      const senderOk =
        archiveSenderFilter === "all" || item.senderId === archiveSenderFilter;
      if (!senderOk) {
        return false;
      }

      if (archiveDateFilter === "all") {
        return true;
      }

      const sourceDate = item.createdAt ? new Date(item.createdAt) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
        return false;
      }

      const itemKey = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
      return itemKey === archiveDateFilter;
    });
  };

  const archiveMediaItems = useMemo(
    () => applyArchiveFilters(mediaItems),
    [mediaItems, archiveSenderFilter, archiveDateFilter],
  );
  const archiveFileItems = useMemo(
    () => applyArchiveFilters(fileItems),
    [fileItems, archiveSenderFilter, archiveDateFilter],
  );
  const archiveLinkItems = useMemo(
    () => applyArchiveFilters(linkItems),
    [linkItems, archiveSenderFilter, archiveDateFilter],
  );

  const joinLink = useMemo(() => {
    const inviteCode = String(settings?.inviteCode ?? "").trim();
    if (!inviteCode) {
      return "";
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/chat?groupInvite=${encodeURIComponent(inviteCode)}`;
  }, [settings?.inviteCode]);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyJoinLink = async () => {
    if (!joinLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(joinLink);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const openMemberPicker = () => {
    if (!canInviteMembers) {
      return;
    }
    setMemberPickerSearch("");
    setSelectedMemberIds([]);
    setIsMemberPickerOpen(true);
  };

  const closeMemberPicker = () => {
    if (isAddingMembers) {
      return;
    }
    setIsMemberPickerOpen(false);
    setMemberPickerSearch("");
    setSelectedMemberIds([]);
  };

  const toggleCandidate = (userId) => {
    setSelectedMemberIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }
      return [...current, userId];
    });
  };

  const submitAddMembers = async () => {
    if (selectedMemberIds.length === 0 || !onAddMembers) {
      return;
    }
    const completed = await onAddMembers(selectedMemberIds);
    if (completed !== false) {
      closeMemberPicker();
    }
  };

  const submitBoardNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      return;
    }

    await onCreateBoardNote?.(trimmed, isNotePinnedToTop);
    setNoteDraft("");
    setIsNotePinnedToTop(true);
    setIsCreateNoteOpen(false);
  };

  const updatePollOption = (index, value) => {
    setPollOptionDrafts((prev) => prev.map((item, currentIndex) => (currentIndex === index ? value : item)));
  };

  const addPollOption = () => {
    setPollOptionDrafts((prev) => {
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, ""];
    });
  };

  const removePollOption = (index) => {
    setPollOptionDrafts((prev) => {
      if (prev.length <= 2) {
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const resetPollDraft = () => {
    setPollQuestionDraft("");
    setPollOptionDrafts(["", ""]);
    setIsPollMultiChoice(false);
    setIsPollAllowChangeVote(true);
    setPollDeadlineMinutes(1440);
    setIsPollHideResultsBeforeVote(false);
    setIsCreatePollOpen(false);
  };

  const submitCreatePoll = async () => {
    const cleanedOptions = pollOptionDrafts
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    const completed = await onCreatePoll?.({
      question: pollQuestionDraft.trim(),
      options: cleanedOptions,
      multipleChoice: isPollMultiChoice,
      allowChangeVote: isPollAllowChangeVote,
      deadlineMinutes: pollDeadlineMinutes,
      hideResultsBeforeVote: isPollHideResultsBeforeVote,
    });

    if (completed !== false) {
      resetPollDraft();
    }
  };

  const submitCreateReminder = async () => {
    const trimmedTitle = reminderTitleDraft.trim();
    if (!trimmedTitle) {
      return;
    }

    const completed = onCreateReminder
      ? await onCreateReminder({
        title: trimmedTitle,
        when: reminderTimeDraft || null,
      })
      : await onSendTemplateMessage?.("REMINDER");

    if (completed !== false) {
      setReminderTitleDraft("");
      setReminderTimeDraft("");
      setIsCreateReminderOpen(false);
    }
  };

  const saveHeaderGroupName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      return;
    }
    const completed = await onSaveGroupName?.(trimmed);
    if (completed !== false) {
      setIsHeaderEditOpen(false);
    }
  };

  const triggerAvatarSelect = () => {
    if (!canEditGroupProfile || isUpdatingGroupProfile) {
      return;
    }
    avatarInputRef.current?.click?.();
  };

  const onAvatarInputChanged = async (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    await onSelectGroupAvatar?.(file);
    event.target.value = "";
  };

  const renderMemberTag = (memberId) => {
    if (memberId === ownerId) {
      return language === "vi" ? "Truong nhom" : "Owner";
    }
    if (adminIds.includes(memberId)) {
      return language === "vi" ? "Pho nhom" : "Admin";
    }
    return language === "vi" ? "Thanh vien" : "Member";
  };

  const iconActionBase =
    "flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center text-[10px] leading-tight transition";

  const openBoardView = () => setPanelView("board");
  const openMembersView = () => setPanelView("members");
  const openReminderView = () => setPanelView("reminders");
  const openArchiveView = (tab) => {
    setArchiveTab(tab);
    setPanelView("archive");
  };
  const backToDefaultPanel = () => setPanelView("default");

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex flex-1 flex-col overflow-hidden">{children}</div>

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[24rem] shrink-0 flex-col border-l border-[#1f4673] bg-[#0d2442] transform transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:w-[24rem] lg:shrink-0 lg:transform-none lg:transition-none ${isPanelOpen ? "translate-x-0" : "translate-x-full"} ${isPanelOpen ? "flex lg:flex" : "hidden lg:hidden"}`}
      >
        <div className="shrink-0 border-b border-[#1f4673] px-3 py-3 lg:px-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-slate-100 lg:text-2xl lg:text-center">
              {language === "vi" ? "Thong tin nhom" : "Group details"}
            </p>
            <button
              type="button"
              onClick={() => onClosePanel?.()}
              className="lg:hidden rounded-lg p-2 text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft size={20} />
            </button>
          </div>

          <div className="mt-3 flex flex-col items-center">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                void onAvatarInputChanged(event);
              }}
              className="hidden"
            />

            <button
              type="button"
              onClick={triggerAvatarSelect}
              disabled={!canEditGroupProfile || isUpdatingGroupProfile}
              className={`group relative rounded-full ${canEditGroupProfile ? "cursor-pointer" : "cursor-default"}`}
              title={
                canEditGroupProfile
                  ? language === "vi"
                    ? "Doi anh nhom"
                    : "Change group avatar"
                  : undefined
              }
            >
              {resolvedConversationAvatar ? (
                <img
                  src={resolvedConversationAvatar}
                  alt={conversation?.name ?? "Group"}
                  className="h-16 w-16 rounded-full border-2 border-slate-500/70 object-cover object-center shadow-lg lg:h-20 lg:w-20"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-500/25 text-lg font-bold text-sky-100 lg:h-20 lg:w-20 lg:text-xl">
                  {initials(conversation?.name ?? "Group")}
                </div>
              )}
              {canEditGroupProfile && (
                <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition group-hover:bg-black/20" />
              )}
            </button>

            {isHeaderEditOpen ? (
              <div className="mt-3 w-full space-y-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder={language === "vi" ? "Ten nhom" : "Group name"}
                  className="h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100"
                />
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(conversation?.name ?? "");
                      setIsHeaderEditOpen(false);
                    }}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    {language === "vi" ? "Huy" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void saveHeaderGroupName();
                    }}
                    disabled={isUpdatingGroupProfile || !nameDraft.trim()}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {language === "vi" ? "Luu ten" : "Save name"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canEditGroupProfile}
                onClick={() => {
                  if (canEditGroupProfile) {
                    setIsHeaderEditOpen(true);
                  }
                }}
                className={`mt-3 max-w-full break-words px-2 text-center text-xl font-semibold leading-tight text-slate-100 lg:text-2xl ${canEditGroupProfile ? "cursor-pointer hover:text-sky-200" : "cursor-default"}`}
              >
                {conversation?.name ?? (language === "vi" ? "Nhom" : "Group")}
              </button>
            )}

            <p className="mt-1 text-xs text-slate-400">
              {language === "vi" ? "Cong dong" : "Community"}
            </p>
            {canEditGroupProfile && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerAvatarSelect}
                  disabled={isUpdatingGroupProfile}
                  className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingGroupProfile
                    ? language === "vi"
                      ? "Dang cap nhat..."
                      : "Updating..."
                    : language === "vi"
                      ? "Doi anh"
                      : "Change avatar"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onPreferenceChange?.({ muted: !Boolean(preferences?.muted) })}
              className={`${iconActionBase} ${preferences?.muted ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700/80 lg:h-8 lg:w-8">
                <BellOff size={12} className="lg:size-[14px]" />
              </span>
              <span>{language === "vi" ? "Bat thong bao" : "Notify"}</span>
            </button>

            <button
              type="button"
              onClick={() => onPreferenceChange?.({ pinned: !Boolean(preferences?.pinned) })}
              className={`${iconActionBase} ${preferences?.pinned ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700/80 lg:h-8 lg:w-8">
                <Pin size={12} className="lg:size-[14px]" />
              </span>
              <span>{language === "vi" ? "Ghim hoi thoai" : "Pin"}</span>
            </button>

            <button
              type="button"
              disabled={!canInviteMembers}
              onClick={openMemberPicker}
              className={`${iconActionBase} ${canInviteMembers ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700/80 lg:h-8 lg:w-8">
                <UserPlus size={12} className="lg:size-[14px]" />
              </span>
              <span>{language === "vi" ? "Them thanh vien" : "Add member"}</span>
            </button>

            <button
              type="button"
              disabled={!canOpenManage}
              onClick={() => setManageMode((prev) => !prev)}
              className={`${iconActionBase} ${canOpenManage ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700/80 lg:h-8 lg:w-8">
                <Settings size={12} className="lg:size-[14px]" />
              </span>
              <span>{language === "vi" ? "Quan ly nhom" : "Manage"}</span>
            </button>
          </div>

          {!canOpenManage && (
            <p className="mt-2 text-center text-[11px] text-amber-300">
              {language === "vi"
                ? "Chi Truong/Pho nhom moi vao duoc phan Quan ly nhom"
                : "Only owner/admin can access group management"}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-2 lg:px-3 lg:py-3">
          {!manageMode && panelView === "default" && (
            <>
              <Section
                title={language === "vi" ? "Thanh vien nhom" : "Members"}
                open={openSections.members}
                onToggle={() => toggleSection("members")}
              >
                <div className="space-y-2 text-sm text-slate-200">
                  <button
                    type="button"
                    onClick={openMembersView}
                    className="flex items-center gap-2 rounded-lg bg-slate-900/35 px-2 py-1.5 hover:bg-slate-800"
                  >
                    <Users size={16} className="text-slate-300" />
                    <span>
                      {safeMembers.length} {language === "vi" ? "thanh vien" : "members"}
                    </span>
                  </button>

                  <div className="rounded-xl bg-slate-900/45 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300">
                          {language === "vi" ? "Link tham gia nhom" : "Join link"}
                        </p>
                        {joinLink ? (
                          <a
                            href={joinLink}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm font-semibold text-sky-300 underline decoration-sky-400/60 underline-offset-2"
                          >
                            {joinLink}
                          </a>
                        ) : (
                          <p className="truncate text-sm font-semibold text-sky-300">
                            {language === "vi" ? "Dang tao link..." : "Generating link..."}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={joinLink || undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!joinLink}
                          className={`grid h-8 w-8 place-items-center rounded-lg ${joinLink ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "pointer-events-none bg-slate-800/60 text-slate-500"}`}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={copyJoinLink}
                          disabled={!joinLink}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                title={language === "vi" ? "Bang tin nhom" : "Board"}
                open={openSections.board}
                onToggle={() => toggleSection("board")}
              >
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                        {language === "vi" ? "Danh sach ghim va ghi chu" : "Pinned & notes"}
                      </p>
                      <span className="text-[11px] text-amber-100">{safePinnedMessages.length}</span>
                    </div>

                    {safePinnedMessages.length === 0 ? (
                      <p className="text-xs text-amber-100/80">
                        {language === "vi" ? "Chua co tin nhan nao duoc ghim" : "No pinned messages yet"}
                      </p>
                    ) : (
                      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                        {safePinnedMessages.slice(0, 15).map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenPinnedMessage?.(item.sourceMessageId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onOpenPinnedMessage?.(item.sourceMessageId);
                              }
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/15 px-2 py-1.5 text-left hover:bg-black/30"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-amber-100">
                                <span className="mr-1 inline-flex align-middle">
                                  {item.itemType === "note" ? <FileText size={12} /> : <Pin size={12} />}
                                </span>
                                <span className="align-middle">{item.title}</span>
                              </p>
                              {item.preview && (
                                <p className="truncate text-[10px] text-amber-100/85">{item.preview}</p>
                              )}
                            </div>
                            <span className="shrink-0">
                              <button
                                type="button"
                                disabled={!canPinBoardItems}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (canPinBoardItems) {
                                    onUnpinPinnedMessage?.(item.sourceMessageId);
                                  }
                                }}
                                className={`rounded-md border border-rose-300/40 px-2 py-1 text-[10px] font-semibold ${canPinBoardItems ? "bg-rose-500/10 text-rose-100 hover:bg-rose-500/20" : "bg-slate-800/60 text-slate-500"}`}
                              >
                                {language === "vi" ? "Bo ghim" : "Unpin"}
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={openReminderView}
                    className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <Newspaper size={16} className="text-slate-300" />
                    <span>{language === "vi" ? "Danh sach nhac hen" : "Reminder list"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openBoardView}
                    className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <FileText size={16} className="text-slate-300" />
                    <span>{language === "vi" ? "Ghi chu, ghim, binh chon" : "Notes, pins, polls"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canCreatePolls}
                    onClick={() => setIsCreatePollOpen(true)}
                    className={`flex w-full items-center gap-2 rounded-xl border border-sky-400/30 px-3 py-2 text-left ${canCreatePolls ? "bg-sky-500/10 hover:bg-sky-500/15" : "bg-slate-800/60 text-slate-500"}`}
                  >
                    <Newspaper size={16} className="text-sky-200" />
                    <span>{language === "vi" ? "Tao binh chon" : "Create poll"}</span>
                  </button>

                  {!canCreatePolls && (
                    <p className="text-[11px] text-amber-300">
                      {language === "vi"
                        ? "Ban khong duoc phep tao binh chon"
                        : "You are not allowed to create polls"}
                    </p>
                  )}

                  {false && isCreatePollOpen && (
                    <div className="rounded-xl border border-sky-300/30 bg-[#101b28] p-2.5">
                      <input
                        type="text"
                        value={pollQuestionDraft}
                        onChange={(event) => setPollQuestionDraft(event.target.value)}
                        maxLength={200}
                        placeholder={language === "vi" ? "Nhap cau hoi binh chon" : "Enter poll question"}
                        className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"
                      />

                      <div className="mt-2 space-y-1.5">
                        {pollOptionDrafts.map((option, index) => (
                          <div key={`poll-option-${index}`} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={option}
                              onChange={(event) => updatePollOption(index, event.target.value)}
                              maxLength={80}
                              placeholder={language === "vi" ? `Lua chon ${index + 1}` : `Option ${index + 1}`}
                              className="h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-xs text-slate-100"
                            />
                            <button
                              type="button"
                              disabled={pollOptionDrafts.length <= 2}
                              onClick={() => removePollOption(index)}
                              className="rounded-md border border-rose-400/40 px-2 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {language === "vi" ? "Xoa" : "Remove"}
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={pollOptionDrafts.length >= 10}
                        onClick={addPollOption}
                        className="mt-2 rounded-md border border-sky-300/40 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {language === "vi" ? "Them lua chon" : "Add option"}
                      </button>

                      <div className="mt-2 space-y-1">
                        <label className="block text-xs text-slate-200">
                          <span>{language === "vi" ? "Han binh chon" : "Poll deadline"}</span>
                          <select
                            value={pollDeadlineMinutes}
                            onChange={(event) => setPollDeadlineMinutes(Number(event.target.value))}
                            className="mt-1 h-8 w-full rounded-md border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"
                          >
                            <option value={30}>{language === "vi" ? "30 phut" : "30 minutes"}</option>
                            <option value={60}>{language === "vi" ? "1 gio" : "1 hour"}</option>
                            <option value={180}>{language === "vi" ? "3 gio" : "3 hours"}</option>
                            <option value={720}>{language === "vi" ? "12 gio" : "12 hours"}</option>
                            <option value={1440}>{language === "vi" ? "1 ngay" : "1 day"}</option>
                            <option value={4320}>{language === "vi" ? "3 ngay" : "3 days"}</option>
                            <option value={10080}>{language === "vi" ? "7 ngay" : "7 days"}</option>
                          </select>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={isPollMultiChoice}
                            onChange={(event) => setIsPollMultiChoice(event.target.checked)}
                            className="h-4 w-4 accent-sky-500"
                          />
                          <span>{language === "vi" ? "Cho phep chon nhieu dap an" : "Allow multiple choices"}</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={isPollAllowChangeVote}
                            onChange={(event) => setIsPollAllowChangeVote(event.target.checked)}
                            className="h-4 w-4 accent-sky-500"
                          />
                          <span>{language === "vi" ? "Cho phep doi lua chon" : "Allow changing vote"}</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={isPollHideResultsBeforeVote}
                            onChange={(event) => setIsPollHideResultsBeforeVote(event.target.checked)}
                            className="h-4 w-4 accent-sky-500"
                          />
                          <span>{language === "vi" ? "An ket qua truoc khi bo phieu" : "Hide results before voting"}</span>
                        </label>
                      </div>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={resetPollDraft}
                          className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        >
                          {language === "vi" ? "Huy" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void submitCreatePoll();
                          }}
                          disabled={!pollQuestionDraft.trim()}
                          className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {language === "vi" ? "Tao binh chon" : "Create poll"}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreateNoteOpen(true)}
                    disabled={!canCreateNotes}
                    className={`flex w-full items-center gap-2 rounded-xl border border-lime-400/30 px-3 py-2 text-left ${canCreateNotes ? "bg-lime-500/10 hover:bg-lime-500/15" : "bg-slate-800/60 text-slate-500"}`}
                  >
                    <FileText size={16} className="text-lime-200" />
                    <span>{language === "vi" ? "Tao ghi chu nhom" : "Create group note"}</span>
                  </button>

                  {false && isCreateNoteOpen && (
                    <div className="rounded-xl border border-lime-300/30 bg-[#101b28] p-2.5">
                      <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder={language === "vi" ? "Nhap noi dung ghi chu..." : "Enter note content..."}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 text-sm text-slate-100"
                      />
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          checked={isNotePinnedToTop}
                          onChange={(event) => setIsNotePinnedToTop(event.target.checked)}
                          className="h-4 w-4 accent-lime-500"
                        />
                        <span>
                          {language === "vi"
                            ? "Ghim len dau tro chuyen"
                            : "Pin to top of conversation"}
                        </span>
                      </label>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreateNoteOpen(false);
                            setNoteDraft("");
                            setIsNotePinnedToTop(true);
                          }}
                          className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        >
                          {language === "vi" ? "Huy" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void submitBoardNote();
                          }}
                          disabled={!noteDraft.trim()}
                          className="rounded-md bg-lime-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {language === "vi" ? "Tao ghi chu" : "Create note"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              <Section
                title={language === "vi" ? "Anh/Video" : "Media"}
                open={openSections.media}
                onToggle={() => toggleSection("media")}
              >
                {mediaItems.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {language === "vi" ? "Chua co media duoc chia se" : "No media shared yet"}
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {previewMediaItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block overflow-hidden rounded-lg border border-slate-700"
                      >
                        {item.type === "VIDEO" ? (
                          <div className="grid h-16 place-items-center bg-slate-900 text-slate-300">
                            <ImageIcon size={16} />
                          </div>
                        ) : (
                          <img
                            src={item.resolvedFileUrl}
                            alt={item.fileName ?? "media"}
                            className="h-16 w-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openArchiveView("media")}
                  className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"
                >
                  {language === "vi" ? "Xem tat ca" : "View all"}
                </button>
              </Section>

              <Section
                title="File"
                open={openSections.files}
                onToggle={() => toggleSection("files")}
              >
                {fileItems.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {language === "vi"
                      ? "Chua co File duoc chia se trong hoi thoai nay"
                      : "No files shared in this conversation"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {previewFileItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {item.fileName ?? item.resolvedFileUrl}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</p>
                        </div>
                        <FileText size={16} className="text-slate-300" />
                      </a>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openArchiveView("files")}
                  className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"
                >
                  {language === "vi" ? "Xem tat ca" : "View all"}
                </button>
              </Section>

              <Section
                title="Link"
                open={openSections.links}
                onToggle={() => toggleSection("links")}
              >
                {linkItems.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {language === "vi" ? "Chua co link duoc chia se" : "No links shared yet"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {previewLinkItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{item.link}</p>
                          <p className="text-[11px] text-sky-300">{toDomain(item.link)}</p>
                        </div>
                        <div className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</div>
                      </a>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openArchiveView("links")}
                  className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"
                >
                  {language === "vi" ? "Xem tat ca" : "View all"}
                </button>
              </Section>

              <Section
                title={language === "vi" ? "Thiet lap bao mat" : "Security settings"}
                open={openSections.security}
                onToggle={() => toggleSection("security")}
              >
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Shield size={15} className="text-slate-300" />
                      <span>{language === "vi" ? "Tin nhan tu xoa" : "Self-destruct"}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {language === "vi" ? "Khong bao gio" : "Never"}
                    </span>
                  </div>

                  <label className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-slate-300" />
                      <span>{language === "vi" ? "An tro chuyen" : "Hide conversation"}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences?.hidden)}
                      onChange={(event) => onPreferenceChange?.({ hidden: event.target.checked })}
                    />
                  </label>
                </div>
              </Section>
            </>
          )}

          {!manageMode && panelView === "members" && (
            <section className="rounded-2xl border border-[#2a4b73] bg-[#0f294a] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-[#14365f]"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lai" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? `Thanh vien (${safeMembers.length})` : `Members (${safeMembers.length})`}
                </h3>
                <span className="w-8" />
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={language === "vi" ? "Tim kiem thanh vien" : "Search members"}
                  className="h-10 w-full rounded-xl border border-[#335b89] bg-[#0a1b34] px-3 text-sm text-slate-100 placeholder:text-slate-500"
                />

                {canInviteMembers && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2a4b73] bg-[#0a1f3d] px-3 py-2.5">
                    <p className="text-xs font-medium text-slate-300">
                      {language === "vi" ? "Them tu danh sach ban be" : "Add from friend list"}
                    </p>
                    <button
                      type="button"
                      onClick={openMemberPicker}
                      className="rounded-xl bg-[#1f8cff] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1578e2]"
                    >
                      {language === "vi" ? "Chon" : "Select"}
                    </button>
                  </div>
                )}

                <div ref={memberListScrollRef} className="max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
                  {filteredPendingMembers.length > 0 && (
                    <div className="space-y-2">
                      <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
                        {language === "vi"
                          ? `Dang cho duyet (${filteredPendingMembers.length})`
                          : `Pending approval (${filteredPendingMembers.length})`}
                      </div>

                      {filteredPendingMembers.map((item) => {
                        const memberId = String(item?.userId ?? "");
                        const profile = userProfileMap?.[memberId];
                        const memberName = profile?.fullName ?? `User ${memberId.slice(0, 8)}`;
                        const avatarUrl = profile?.avatarUrl ?? null;
                        const requestedById = String(item?.requestedByUserId ?? "").trim();
                        const requestedByProfile = requestedById ? userProfileMap?.[requestedById] : null;
                        const requestedByName = requestedById
                          ? requestedByProfile?.fullName ?? `User ${requestedById.slice(0, 8)}`
                          : null;

                        return (
                          <div key={`pending-${memberId}`} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={memberName} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />
                                ) : (
                                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[#6a4b1c] text-xs font-semibold text-slate-100">
                                    {initials(memberName)}
                                  </div>
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-400 px-1.5 py-[2px] text-[9px] font-bold uppercase text-slate-900">
                                  {language === "vi" ? "Cho duyet" : "Pending"}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold leading-5 text-slate-100">{memberName}</p>
                                <p className="truncate pt-0.5 text-xs text-amber-100/90">
                                  {language === "vi"
                                    ? `${memberName} dang cho truong, pho nhom duyet vao nhom`
                                    : `${memberName} is waiting for admin approval to join`}
                                </p>
                                {requestedByName && (
                                  <p className="truncate pt-1 text-[11px] text-slate-300/90">
                                    {language === "vi"
                                      ? `Nguoi them: ${requestedByName}`
                                      : `Requested by: ${requestedByName}`}
                                  </p>
                                )}
                              </div>
                            </div>

                            {(isOwner || isAdmin) && (
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => onRejectPendingMember?.(memberId)}
                                  className="rounded-lg border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                                >
                                  {language === "vi" ? "Tu choi" : "Reject"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onApprovePendingMember?.(memberId)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                                >
                                  {language === "vi" ? "Dong y" : "Approve"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {filteredMembers.map((memberId) => {
                    const profile = userProfileMap?.[memberId];
                    const memberName = profile?.fullName ?? `User ${memberId.slice(0, 8)}`;
                    const avatarUrl = profile?.avatarUrl ?? null;
                    const memberIsOwner = memberId === ownerId;
                    const memberIsAdmin = adminIds.includes(memberId);
                    const canManageThisMember = memberId !== currentUserId;
                    const canRemoveMember = isOwner
                      ? !memberIsOwner
                      : isAdmin
                        ? !memberIsOwner && !memberIsAdmin
                        : false;
                    const keyColorClass = memberIsOwner
                      ? "text-amber-300"
                      : memberIsAdmin
                        ? "text-slate-300"
                        : null;

                    return (
                      <div key={memberId} className="group relative rounded-2xl border border-[#2a4b73] bg-[#0a1f3d] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={memberName} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />
                            ) : (
                              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#1d4f83] text-xs font-semibold text-slate-100">
                                {initials(memberName)}
                              </div>
                            )}
                            {keyColorClass && (
                              <span className={`absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-slate-900 ring-1 ring-[#335b89] ${keyColorClass}`}>
                                <KeyRound size={11} />
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold leading-5 text-slate-100">{memberName}</p>
                            <p className="truncate pt-0.5 text-xs text-slate-400">{renderMemberTag(memberId)}</p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onMentionMember?.(memberId)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-amber-300/40 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10"
                            >
                              @
                            </button>
                            {canManageThisMember && (
                              <button
                                type="button"
                                ref={(node) => {
                                  if (node) {
                                    memberActionButtonRefs.current[memberId] = node;
                                    return;
                                  }
                                  delete memberActionButtonRefs.current[memberId];
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMemberActionMenu(memberId);
                                }}
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-[#14365f] hover:text-white group-hover:opacity-100"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {canManageThisMember && activeMemberActionId === memberId && (
                          <div
                            className={`absolute right-3 z-20 min-w-[11rem] rounded-xl border border-[#335b89] bg-[#102d52] p-1.5 shadow-2xl ${activeMemberActionDirection === "up" ? "bottom-[calc(100%-0.25rem)]" : "top-[calc(100%-0.25rem)]"}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {isOwner && !memberIsOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleAdmin?.(memberId, !memberIsAdmin);
                                  setActiveMemberActionId(null);
                                }}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700"
                              >
                                {memberIsAdmin
                                  ? language === "vi"
                                    ? "Go quyen pho nhom"
                                    : "Remove admin role"
                                  : language === "vi"
                                    ? "Them quyen pho nhom"
                                    : "Grant admin role"}
                              </button>
                            )}
                            {isOwner && !memberIsOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  void onUpdateSettings?.({
                                    transferOwnerId: memberId,
                                    successMessageVi: "Da chuyen quyen truong nhom",
                                    successMessageEn: "Ownership transferred",
                                  });
                                  setActiveMemberActionId(null);
                                }}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-indigo-200 hover:bg-slate-700"
                              >
                                {language === "vi" ? "Chuyen truong nhom" : "Transfer owner"}
                              </button>
                            )}
                            {canRemoveMember && (
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveMember?.(memberId);
                                  setActiveMemberActionId(null);
                                }}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/10"
                              >
                                {language === "vi" ? "Xoa khoi nhom" : "Remove member"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {!manageMode && panelView === "board" && (
            <section className="rounded-2xl border border-slate-700 bg-[#1a2433] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lai" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? "Bang tin nhom" : "Group board"}
                </h3>
                <button
                  type="button"
                  disabled={!canCreateNotes}
                  onClick={() => setIsCreateNoteOpen(true)}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${canCreateNotes ? "bg-sky-600 text-white hover:bg-sky-500" : "bg-slate-700 text-slate-500"}`}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-900/45 p-1">
                {[
                  { id: "all", labelVi: "Tat ca", labelEn: "All" },
                  { id: "pins", labelVi: "Tin ghim", labelEn: "Pins" },
                  { id: "notes", labelVi: "Ghi chu", labelEn: "Notes" },
                  { id: "polls", labelVi: "Binh chon", labelEn: "Polls" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBoardTab(tab.id)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${boardTab === tab.id ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                  >
                    {language === "vi" ? tab.labelVi : tab.labelEn}
                  </button>
                ))}
              </div>

              <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                {boardItemsForView.length === 0 ? (
                  <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                    {language === "vi" ? "Chua co du lieu trong muc nay" : "No items in this tab yet"}
                  </p>
                ) : (
                  boardItemsForView.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                        <span className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</span>
                      </div>
                      {item.preview && <p className="mt-1 text-xs text-slate-300">{item.preview}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        {item.itemType === "pin" && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenPinnedMessage?.(item.sourceId)}
                              className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
                            >
                              {language === "vi" ? "Xem" : "Open"}
                            </button>
                            <button
                              type="button"
                              disabled={!canPinBoardItems}
                              onClick={() => {
                                if (canPinBoardItems) {
                                  onUnpinPinnedMessage?.(item.sourceId);
                                }
                              }}
                              className={`rounded-md border border-rose-400/40 px-2 py-1 text-[11px] ${canPinBoardItems ? "text-rose-200 hover:bg-rose-500/10" : "text-slate-500"}`}
                            >
                              {language === "vi" ? "Bo ghim" : "Unpin"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateNoteOpen(true)}
                  disabled={!canCreateNotes}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${canCreateNotes ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}
                >
                  {language === "vi" ? "Tao ghi chu" : "Create note"}
                </button>
                <button
                  type="button"
                  disabled={!canCreatePolls}
                  onClick={() => setIsCreatePollOpen(true)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${canCreatePolls ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}
                >
                  {language === "vi" ? "Tao binh chon" : "Create poll"}
                </button>
              </div>
            </section>
          )}

          {!manageMode && panelView === "reminders" && (
            <section className="rounded-2xl border border-slate-700 bg-[#1a2433] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lai" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? "Danh sach nhac hen" : "Reminder list"}
                </h3>
                <button
                  type="button"
                  disabled={!canCreateReminders}
                  onClick={() => setIsCreateReminderOpen(true)}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${canCreateReminders ? "bg-sky-600 text-white hover:bg-sky-500" : "bg-slate-700 text-slate-500"}`}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {reminderItems.length === 0 ? (
                  <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                    {language === "vi" ? "Chua co nhac hen" : "No reminders yet"}
                  </p>
                ) : (
                  reminderItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-3">
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.eventTime ? formatShortDate(item.eventTime) : formatShortDate(item.createdAtMs)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                disabled={!canCreateReminders}
                onClick={() => setIsCreateReminderOpen(true)}
                className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold ${canCreateReminders ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}
              >
                {language === "vi" ? "Tao nhac hen" : "Create reminder"}
              </button>
            </section>
          )}

          {!manageMode && panelView === "archive" && (
            <section className="rounded-2xl border border-slate-700 bg-[#1a2433] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lai" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? "Kho luu tru" : "Archive"}
                </h3>
                <span />
              </div>

              <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-900/45 p-1">
                {[
                  { id: "media", icon: <ImageIcon size={13} />, label: "Anh/Video" },
                  { id: "files", icon: <FileText size={13} />, label: "Files" },
                  { id: "links", icon: <LinkIcon size={13} />, label: "Links" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setArchiveTab(tab.id)}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${archiveTab === tab.id ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="mb-2 grid grid-cols-2 gap-2">
                <select
                  value={archiveSenderFilter}
                  onChange={(event) => setArchiveSenderFilter(event.target.value)}
                  className="h-8 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"
                >
                  <option value="all">{language === "vi" ? "Nguoi gui" : "Sender"}</option>
                  {archiveSenderOptions.map((senderId) => (
                    <option key={senderId} value={senderId}>
                      {userProfileMap?.[senderId]?.fullName ?? senderId}
                    </option>
                  ))}
                </select>
                <select
                  value={archiveDateFilter}
                  onChange={(event) => setArchiveDateFilter(event.target.value)}
                  className="h-8 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"
                >
                  <option value="all">{language === "vi" ? "Ngay gui" : "Date"}</option>
                  {archiveDateOptions.map((dateKey) => (
                    <option key={dateKey} value={dateKey}>
                      {dateKey}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {archiveTab === "media" &&
                  (archiveMediaItems.length === 0 ? (
                    <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                      {language === "vi" ? "Khong co du lieu" : "No items"}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {archiveMediaItems.map((item) => (
                        <a key={item.id} href={item.resolvedFileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700">
                          {item.type === "VIDEO" ? (
                            <div className="grid h-16 place-items-center bg-slate-900 text-slate-300">
                              <ImageIcon size={16} />
                            </div>
                          ) : (
                            <img src={item.resolvedFileUrl} alt={item.fileName ?? "media"} className="h-16 w-full object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  ))}

                {archiveTab === "files" &&
                  (archiveFileItems.length === 0 ? (
                    <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                      {language === "vi" ? "Khong co du lieu" : "No items"}
                    </p>
                  ) : (
                    archiveFileItems.map((item) => (
                      <a key={item.id} href={item.resolvedFileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{item.fileName ?? item.resolvedFileUrl}</p>
                          <p className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</p>
                        </div>
                        <FileText size={15} className="text-slate-300" />
                      </a>
                    ))
                  ))}

                {archiveTab === "links" &&
                  (archiveLinkItems.length === 0 ? (
                    <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                      {language === "vi" ? "Khong co du lieu" : "No items"}
                    </p>
                  ) : (
                    archiveLinkItems.map((item) => (
                      <a key={item.id} href={item.link} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{item.link}</p>
                          <p className="text-[11px] text-sky-300">{toDomain(item.link)}</p>
                        </div>
                        <div className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</div>
                      </a>
                    ))
                  ))}
              </div>
            </section>
          )}

          {manageMode && canOpenManage && panelView === "default" && (
            <Section
              title={language === "vi" ? "Quan ly nhom" : "Group management"}
              open={openSections.manage}
              onToggle={() => toggleSection("manage")}
            >
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-900/45 p-3">
                  <p className="text-sm font-semibold text-slate-100">
                    {language === "vi" ? "Cho phep cac thanh vien trong nhom:" : "Allow members to:"}
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-200">
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Thay doi ten va anh dai dien" : "Edit group name and avatar"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.renameGroup}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            renameGroup: checked,
                          }));
                          void onUpdateSettings?.({ allowMemberEditGroupInfo: checked });
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Ghim tin nhan, ghi chu, binh chon" : "Pin messages, notes, polls"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.pinBoardItems}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            pinBoardItems: checked,
                          }));
                          void onUpdateSettings?.({ allowMemberPinBoardItems: checked });
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Tao moi ghi chu" : "Create notes"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.createNote}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            createNote: checked,
                          }));
                          void onUpdateSettings?.({ allowMemberCreateNotes: checked });
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Tao moi nhac hen" : "Create reminders"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.createReminder}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            createReminder: checked,
                          }));
                          void onUpdateSettings?.({ allowMemberCreateReminders: checked });
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Tao moi binh chon" : "Create polls"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.createPoll}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            createPoll: checked,
                          }));
                          void onUpdateSettings?.({ allowMemberCreatePolls: checked });
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Gui tin nhan" : "Send message"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.sendMessage}
                        disabled={!canOpenManage}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            sendMessage: checked,
                          }));
                          void onUpdateSettings?.({ onlyAdminsCanMessage: !checked });
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/45 p-3 text-sm text-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span>{language === "vi" ? "Che do phe duyet thanh vien moi" : "Require join approval"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.requireApprovalToJoin)}
                      disabled={!canEditSecuritySettings}
                      onChange={(event) => {
                        void onUpdateSettings?.({ requireApprovalToJoin: event.target.checked });
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span>{language === "vi" ? "Danh dau tin nhan tu truong/pho nhom" : "Highlight owner/admin messages"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.highlightAdminMessages)}
                      disabled={!canEditSecuritySettings}
                      onChange={(event) => {
                        void onUpdateSettings?.({ highlightAdminMessages: event.target.checked });
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span>{language === "vi" ? "Cho phep dung link tham gia nhom" : "Allow invite by link"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.allowMemberInvite)}
                      disabled={!canEditSecuritySettings}
                      onChange={(event) => {
                        void onUpdateSettings?.({ allowMemberInvite: event.target.checked });
                      }}
                    />
                  </div>

                  <div className="mt-3 rounded-lg bg-[#0d1d36] px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      {joinLink ? (
                        <a
                          href={joinLink}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-w-0 truncate text-sm font-semibold text-sky-200 underline decoration-sky-300/60 underline-offset-2"
                        >
                          {joinLink}
                        </a>
                      ) : (
                        <p className="truncate text-sm font-semibold text-sky-200">
                          {language === "vi" ? "Dang tao link..." : "Generating link..."}
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        <a
                          href={joinLink || undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!joinLink}
                          className={`grid h-8 w-8 place-items-center rounded-lg ${joinLink ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "pointer-events-none bg-slate-800/60 text-slate-500"}`}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={copyJoinLink}
                          disabled={!joinLink}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {!canEditSecuritySettings && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      {language === "vi"
                        ? "Chi truong nhom hoac pho nhom moi doi duoc cac cai dat bao mat va link moi"
                        : "Only the owner or admins can change security and invite-link settings"}
                    </p>
                  )}
                </div>

              </div>
            </Section>
          )}

          {panelView === "default" && (
            <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle size={15} />
                <p className="text-sm font-semibold">
                  {language === "vi" ? "Bao cao va roi nhom" : "Report and leave"}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-400/50 px-2 py-2 text-sm font-semibold text-rose-200"
                >
                  {language === "vi" ? "Bao xau" : "Report"}
                </button>
                <button
                  type="button"
                  onClick={() => onLeaveGroup?.()}
                  className="flex-1 rounded-lg border border-rose-400/50 px-2 py-2 text-sm font-semibold text-rose-200"
                >
                  {language === "vi" ? "Roi nhom" : "Leave"}
                </button>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onDeleteGroup?.()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  <Trash2 size={14} />
                  <span>{language === "vi" ? "Giai tan nhom" : "Delete group"}</span>
                </button>
              )}
            </section>
          )}
        </div>
      </aside>

      {isCreateNoteOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#111b2a] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-100">
                {language === "vi" ? "Tao ghi chu nhom" : "Create group note"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateNoteOpen(false);
                  setNoteDraft("");
                  setIsNotePinnedToTop(true);
                }}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {language === "vi" ? "Dong" : "Close"}
              </button>
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder={language === "vi" ? "Nhap noi dung ghi chu..." : "Enter note content..."}
              rows={4}
              className="mt-3 w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={isNotePinnedToTop}
                onChange={(event) => setIsNotePinnedToTop(event.target.checked)}
                className="h-4 w-4 accent-lime-500"
              />
              <span>{language === "vi" ? "Ghim len dau tro chuyen" : "Pin to top of conversation"}</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateNoteOpen(false);
                  setNoteDraft("");
                  setIsNotePinnedToTop(true);
                }}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                {language === "vi" ? "Huy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitBoardNote();
                }}
                disabled={!noteDraft.trim()}
                className="rounded-md bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {language === "vi" ? "Tao ghi chu" : "Create note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreatePollOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#111b2a] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-100">
                {language === "vi" ? "Tao binh chon" : "Create poll"}
              </h3>
              <button
                type="button"
                onClick={resetPollDraft}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {language === "vi" ? "Dong" : "Close"}
              </button>
            </div>
            <input
              type="text"
              value={pollQuestionDraft}
              onChange={(event) => setPollQuestionDraft(event.target.value)}
              maxLength={200}
              placeholder={language === "vi" ? "Nhap cau hoi binh chon" : "Enter poll question"}
              className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"
            />
            <div className="mt-2 space-y-1.5">
              {pollOptionDrafts.map((option, index) => (
                <div key={`poll-modal-option-${index}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(event) => updatePollOption(index, event.target.value)}
                    maxLength={80}
                    placeholder={language === "vi" ? `Lua chon ${index + 1}` : `Option ${index + 1}`}
                    className="h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={pollOptionDrafts.length <= 2}
                    onClick={() => removePollOption(index)}
                    className="rounded-md border border-rose-400/40 px-2 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {language === "vi" ? "Xoa" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={pollOptionDrafts.length >= 10}
                onClick={addPollOption}
                className="rounded-md border border-sky-300/40 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {language === "vi" ? "Them lua chon" : "Add option"}
              </button>
              <select
                value={pollDeadlineMinutes}
                onChange={(event) => setPollDeadlineMinutes(Number(event.target.value))}
                className="h-8 rounded-md border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"
              >
                <option value={30}>{language === "vi" ? "30 phut" : "30 minutes"}</option>
                <option value={60}>{language === "vi" ? "1 gio" : "1 hour"}</option>
                <option value={180}>{language === "vi" ? "3 gio" : "3 hours"}</option>
                <option value={720}>{language === "vi" ? "12 gio" : "12 hours"}</option>
                <option value={1440}>{language === "vi" ? "1 ngay" : "1 day"}</option>
                <option value={4320}>{language === "vi" ? "3 ngay" : "3 days"}</option>
                <option value={10080}>{language === "vi" ? "7 ngay" : "7 days"}</option>
              </select>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-200">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isPollMultiChoice} onChange={(event) => setIsPollMultiChoice(event.target.checked)} className="h-4 w-4 accent-sky-500" />
                <span>{language === "vi" ? "Cho phep chon nhieu dap an" : "Allow multiple choices"}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isPollAllowChangeVote} onChange={(event) => setIsPollAllowChangeVote(event.target.checked)} className="h-4 w-4 accent-sky-500" />
                <span>{language === "vi" ? "Cho phep doi lua chon" : "Allow changing vote"}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isPollHideResultsBeforeVote} onChange={(event) => setIsPollHideResultsBeforeVote(event.target.checked)} className="h-4 w-4 accent-sky-500" />
                <span>{language === "vi" ? "An ket qua truoc khi bo phieu" : "Hide results before voting"}</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={resetPollDraft} className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                {language === "vi" ? "Huy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitCreatePoll();
                }}
                disabled={!pollQuestionDraft.trim()}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {language === "vi" ? "Tao binh chon" : "Create poll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateReminderOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#111b2a] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-100">
                {language === "vi" ? "Tao nhac hen" : "Create reminder"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateReminderOpen(false);
                  setReminderTitleDraft("");
                  setReminderTimeDraft("");
                }}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {language === "vi" ? "Dong" : "Close"}
              </button>
            </div>
            <input
              type="text"
              value={reminderTitleDraft}
              onChange={(event) => setReminderTitleDraft(event.target.value)}
              placeholder={language === "vi" ? "Tieu de nhac hen" : "Reminder title"}
              className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"
            />
            <label className="mt-2 block text-xs text-slate-300">
              <span className="mb-1 inline-block">{language === "vi" ? "Thoi gian (tuy chon)" : "Time (optional)"}</span>
              <input
                type="datetime-local"
                value={reminderTimeDraft}
                onChange={(event) => setReminderTimeDraft(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateReminderOpen(false);
                  setReminderTitleDraft("");
                  setReminderTimeDraft("");
                }}
                className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                {language === "vi" ? "Huy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitCreateReminder();
                }}
                disabled={!reminderTitleDraft.trim()}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {language === "vi" ? "Tao" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMemberPickerOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#111b2a] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {language === "vi" ? "Them thanh vien" : "Add members"}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {language === "vi"
                    ? "Chon mot hoac nhieu ban be de them vao nhom"
                    : "Select one or multiple friends to add into this group"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMemberPicker}
                disabled={isAddingMembers}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {language === "vi" ? "Dong" : "Close"}
              </button>
            </div>

            <input
              type="text"
              value={memberPickerSearch}
              onChange={(event) => setMemberPickerSearch(event.target.value)}
              placeholder={language === "vi" ? "Tim theo ten, email, userId" : "Search by name, email, userId"}
              className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <div className="mt-3 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {addableFriendCandidates.length === 0 ? (
                <div className="rounded-lg border border-slate-700 bg-slate-900/45 px-3 py-4 text-sm text-slate-300">
                  {language === "vi"
                    ? "Khong co ban be phu hop de them vao nhom"
                    : "No matching friends available to add"}
                </div>
              ) : (
                addableFriendCandidates.map((candidate) => {
                  const selected = selectedMemberIds.includes(candidate.userId);
                  return (
                    <button
                      key={candidate.userId}
                      type="button"
                      onClick={() => toggleCandidate(candidate.userId)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-900/35 hover:bg-slate-800"}`}
                    >
                      {candidate.avatarUrl ? (
                        <img
                          src={candidate.avatarUrl}
                          alt={candidate.displayName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
                          {initials(candidate.displayName)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {candidate.displayName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {candidate.email || candidate.userId}
                        </p>
                      </div>

                      <span
                        className={`h-4 w-4 rounded-full border ${selected ? "border-sky-400 bg-sky-400" : "border-slate-500"}`}
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-300">
                {language === "vi"
                  ? `Da chon ${selectedMemberIds.length} nguoi`
                  : `${selectedMemberIds.length} selected`}
              </p>
              <button
                type="button"
                onClick={() => {
                  void submitAddMembers();
                }}
                disabled={isAddingMembers || selectedMemberIds.length === 0}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAddingMembers
                  ? language === "vi"
                    ? "Dang them..."
                    : "Adding..."
                  : language === "vi"
                    ? "Them thanh vien"
                    : "Add members"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
