import { useEffect, useMemo, useRef, useState } from "react";

import {

&#x20; ArrowLeft,

&#x20; AlertTriangle,

&#x20; BellOff,

&#x20; ChevronDown,

&#x20; ChevronUp,

&#x20; Copy,

&#x20; ExternalLink,

&#x20; FileText,

&#x20; Image as ImageIcon,

&#x20; KeyRound,

&#x20; Link as LinkIcon,

&#x20; MoreHorizontal,

&#x20; Newspaper,

&#x20; Pin,

&#x20; Plus,

&#x20; Settings,

&#x20; Shield,

&#x20; Trash2,

&#x20; UserPlus,

&#x20; Users,

} from "lucide-react";

import { resolveMediaUrl } from "../utils/mediaUrl";



function initials(name) {

&#x20; const parts = (name || "").split(" ").filter(Boolean);

&#x20; if (parts.length === 0) return "G";

&#x20; return parts

&#x20;   .slice(0, 2)

&#x20;   .map((part) => part\[0]?.toUpperCase() ?? "")

&#x20;   .join("");

}



function tryParseJson(raw) {

&#x20; try {

&#x20;   return JSON.parse(raw);

&#x20; } catch {

&#x20;   return null;

&#x20; }

}



function extractLinks(text) {

&#x20; const matches = String(text ?? "").match(/https?:\\/\\/\[^\\s]+/g);

&#x20; return matches ?? \[];

}



function formatShortDate(value) {

&#x20; if (!value) return "--/--";

&#x20; const date = new Date(value);

&#x20; if (Number.isNaN(date.getTime())) return "--/--";

&#x20; const day = `${date.getDate()}`.padStart(2, "0");

&#x20; const month = `${date.getMonth() + 1}`.padStart(2, "0");

&#x20; return `${day}/${month}`;

}



function toDomain(link) {

&#x20; try {

&#x20;   return new URL(link).hostname;

&#x20; } catch {

&#x20;   return link;

&#x20; }

}



function Section({ title, open, onToggle, children }) {

&#x20; return (

&#x20;   <section className="rounded-2xl border border-\[#2a4b73] bg-\[#0f294a]">

&#x20;     <button

&#x20;       type="button"

&#x20;       onClick={onToggle}

&#x20;       className="flex w-full items-center justify-between px-3 py-3 text-left"

&#x20;     >

&#x20;       <span className="text-lg font-semibold text-slate-100">{title}</span>

&#x20;       {open ? (

&#x20;         <ChevronUp size={16} className="text-slate-400" />

&#x20;       ) : (

&#x20;         <ChevronDown size={16} className="text-slate-400" />

&#x20;       )}

&#x20;     </button>

&#x20;     {open \&\& <div className="border-t border-slate-700 px-3 py-3">{children}</div>}

&#x20;   </section>

&#x20; );

}



export function GroupChat({

&#x20; language,

&#x20; conversation,

&#x20; isPanelOpen = true,

&#x20; members,

&#x20; pendingMembers,

&#x20; friendContacts,

&#x20; pinnedMessages,

&#x20; onOpenPinnedMessage,

&#x20; onUnpinPinnedMessage,

&#x20; onCreateBoardNote,

&#x20; onCreatePoll,

&#x20; onCreateReminder,

&#x20; userProfileMap,

&#x20; messages,

&#x20; currentUserId,

&#x20; settings,

&#x20; preferences,

&#x20; onRefreshSettings,

&#x20; onUpdateSettings,

&#x20; onAddMembers,

&#x20; isAddingMembers,

&#x20; onSaveGroupName,

&#x20; onSelectGroupAvatar,

&#x20; onClearGroupAvatar,

&#x20; isUpdatingGroupProfile,

&#x20; onRemoveMember,

&#x20; onApprovePendingMember,

&#x20; onRejectPendingMember,

&#x20; onToggleAdmin,

&#x20; onMentionMember,

&#x20; onLeaveGroup,

&#x20; onDeleteGroup,

&#x20; onPreferenceChange,

&#x20; onSendTemplateMessage,

&#x20; children,

}) {

&#x20; const safeMembers = members ?? \[];

&#x20; const safePendingMembers = pendingMembers ?? \[];

&#x20; const safeFriendContacts = friendContacts ?? \[];

&#x20; const safePinnedMessages = pinnedMessages ?? \[];

&#x20; const safeMessages = messages ?? \[];



&#x20; const \[nameDraft, setNameDraft] = useState(conversation?.name ?? "");

&#x20; const \[searchText, setSearchText] = useState("");

&#x20; const \[isHeaderEditOpen, setIsHeaderEditOpen] = useState(false);

&#x20; const \[memberPickerSearch, setMemberPickerSearch] = useState("");

&#x20; const \[selectedMemberIds, setSelectedMemberIds] = useState(\[]);

&#x20; const \[isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);

&#x20; const \[isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);

&#x20; const \[noteDraft, setNoteDraft] = useState("");

&#x20; const \[isNotePinnedToTop, setIsNotePinnedToTop] = useState(true);

&#x20; const \[isCreatePollOpen, setIsCreatePollOpen] = useState(false);

&#x20; const \[pollQuestionDraft, setPollQuestionDraft] = useState("");

&#x20; const \[pollOptionDrafts, setPollOptionDrafts] = useState(\["", ""]);

&#x20; const \[isPollMultiChoice, setIsPollMultiChoice] = useState(false);

&#x20; const \[isPollAllowChangeVote, setIsPollAllowChangeVote] = useState(true);

&#x20; const \[pollDeadlineMinutes, setPollDeadlineMinutes] = useState(1440);

&#x20; const \[isPollHideResultsBeforeVote, setIsPollHideResultsBeforeVote] = useState(false);

&#x20; const \[isCreateReminderOpen, setIsCreateReminderOpen] = useState(false);

&#x20; const \[reminderTitleDraft, setReminderTitleDraft] = useState("");

&#x20; const \[reminderTimeDraft, setReminderTimeDraft] = useState("");

&#x20; const \[manageMode, setManageMode] = useState(false);

&#x20; const \[panelView, setPanelView] = useState("default");

&#x20; const \[boardTab, setBoardTab] = useState("all");

&#x20; const \[archiveTab, setArchiveTab] = useState("media");

&#x20; const \[archiveSenderFilter, setArchiveSenderFilter] = useState("all");

&#x20; const \[archiveDateFilter, setArchiveDateFilter] = useState("all");

&#x20; const \[activeMemberActionId, setActiveMemberActionId] = useState(null);

&#x20; const \[activeMemberActionDirection, setActiveMemberActionDirection] = useState("down");

&#x20; const \[openSections, setOpenSections] = useState({

&#x20;   members: true,

&#x20;   board: true,

&#x20;   media: true,

&#x20;   files: true,

&#x20;   links: true,

&#x20;   security: true,

&#x20;   manage: true,

&#x20;   memberList: true,

&#x20; });

&#x20; const avatarInputRef = useRef(null);

&#x20; const memberListScrollRef = useRef(null);

&#x20; const memberActionButtonRefs = useRef({});



&#x20; useEffect(() => {

&#x20;   setNameDraft(conversation?.name ?? "");

&#x20;   setManageMode(false);

&#x20;   setPanelView("default");

&#x20;   setBoardTab("all");

&#x20;   setArchiveTab("media");

&#x20;   setArchiveSenderFilter("all");

&#x20;   setArchiveDateFilter("all");

&#x20;   setActiveMemberActionId(null);

&#x20;   setActiveMemberActionDirection("down");

&#x20;   setIsHeaderEditOpen(false);

&#x20;   setIsCreateNoteOpen(false);

&#x20;   setIsCreatePollOpen(false);

&#x20;   setIsCreateReminderOpen(false);

&#x20; }, \[conversation?.id, conversation?.name, conversation?.avatar]);



&#x20; const ownerId = settings?.ownerId ?? conversation?.ownerId ?? null;

&#x20; const adminIds = settings?.admins ?? conversation?.admins ?? \[];

&#x20; const isOwner = Boolean(

&#x20;   settings?.isOwner ?? (currentUserId \&\& ownerId \&\& currentUserId === ownerId),

&#x20; );

&#x20; const isAdmin = Boolean(

&#x20;   settings?.isAdmin ?? (currentUserId \&\& adminIds.includes(currentUserId)),

&#x20; );

&#x20; const canOpenManage = isOwner || isAdmin;

&#x20; const allowMemberEditGroupInfo = Boolean(

&#x20;   settings?.allowMemberEditGroupInfo ?? settings?.allowMembersEditGroupProfile,

&#x20; );

&#x20; const allowMemberPinBoardItems = Boolean(

&#x20;   settings?.allowMemberPinBoardItems ?? settings?.allowMembersPinBoardItems,

&#x20; );

&#x20; const allowMemberCreateNotes = Boolean(

&#x20;   settings?.allowMemberCreateNotes ?? settings?.allowMembersCreateNotes,

&#x20; );

&#x20; const allowMemberCreateReminders = Boolean(settings?.allowMemberCreateReminders);

&#x20; const allowMemberCreatePolls = Boolean(

&#x20;   settings?.allowMemberCreatePolls ?? settings?.allowMembersCreatePolls,

&#x20; );

&#x20; const allowMembersSendMessages = Boolean(

&#x20;   settings?.allowMembersSendMessages ?? !settings?.onlyAdminsCanMessage,

&#x20; );

&#x20; const allowMemberInvite = Boolean(settings?.allowMemberInvite);

&#x20; const canInviteMembers = canOpenManage || allowMemberInvite;

&#x20; const canEditSecuritySettings = canOpenManage;

&#x20; const canEditGroupProfile = canOpenManage || allowMemberEditGroupInfo;

&#x20; const canPinBoardItems = canOpenManage || allowMemberPinBoardItems;

&#x20; const canCreateNotes = canOpenManage || allowMemberCreateNotes;

&#x20; const canCreateReminders = canOpenManage || allowMemberCreateReminders;

&#x20; const canCreatePolls = canOpenManage || allowMemberCreatePolls;

&#x20; const resolvedConversationAvatar = resolveMediaUrl(conversation?.avatar ?? null);



&#x20; useEffect(() => {

&#x20;   const closeMemberActionMenu = () => {

&#x20;     setActiveMemberActionId(null);

&#x20;     setActiveMemberActionDirection("down");

&#x20;   };

&#x20;   document.addEventListener("click", closeMemberActionMenu);

&#x20;   return () => {

&#x20;     document.removeEventListener("click", closeMemberActionMenu);

&#x20;   };

&#x20; }, \[]);



&#x20; const openMemberActionMenu = (memberId) => {

&#x20;   const trigger = memberActionButtonRefs.current\[memberId];

&#x20;   const container = memberListScrollRef.current;

&#x20;   let nextDirection = "down";



&#x20;   if (trigger \&\& container) {

&#x20;     const triggerRect = trigger.getBoundingClientRect();

&#x20;     const containerRect = container.getBoundingClientRect();

&#x20;     const estimatedMenuHeight = 132;

&#x20;     const spaceBelow = containerRect.bottom - triggerRect.bottom;

&#x20;     const spaceAbove = triggerRect.top - containerRect.top;



&#x20;     if (spaceBelow < estimatedMenuHeight \&\& spaceAbove > spaceBelow) {

&#x20;       nextDirection = "up";

&#x20;     }

&#x20;   }



&#x20;   setActiveMemberActionDirection(nextDirection);

&#x20;   setActiveMemberActionId((prev) => (prev === memberId ? null : memberId));

&#x20; };



&#x20; const parsedMessages = useMemo(() => {

&#x20;   return safeMessages

&#x20;     .map((message) => {

&#x20;       const type = String(message.type ?? "TEXT").toUpperCase();

&#x20;       const json = tryParseJson(message.content ?? "");

&#x20;       const createdAt = message.createdAt ? Date.parse(message.createdAt) : 0;

&#x20;       return {

&#x20;         ...message,

&#x20;         type,

&#x20;         json,

&#x20;         createdAtMs: Number.isFinite(createdAt) ? createdAt : 0,

&#x20;         links: extractLinks(message.content ?? ""),

&#x20;         resolvedFileUrl: resolveMediaUrl(message.fileUrl ?? null),

&#x20;       };

&#x20;     })

&#x20;     .sort((left, right) => right.createdAtMs - left.createdAtMs);

&#x20; }, \[safeMessages]);



&#x20; const filteredMembers = useMemo(() => {

&#x20;   const normalized = searchText.trim().toLowerCase();

&#x20;   if (!normalized) {

&#x20;     return safeMembers;

&#x20;   }

&#x20;   return safeMembers.filter((memberId) => {

&#x20;     const profile = userProfileMap?.\[memberId];

&#x20;     const name = String(profile?.fullName ?? memberId).toLowerCase();

&#x20;     return name.includes(normalized) || memberId.toLowerCase().includes(normalized);

&#x20;   });

&#x20; }, \[safeMembers, searchText, userProfileMap]);



&#x20; const filteredPendingMembers = useMemo(() => {

&#x20;   const normalized = searchText.trim().toLowerCase();

&#x20;   if (!normalized) {

&#x20;     return safePendingMembers;

&#x20;   }

&#x20;   return safePendingMembers.filter((item) => {

&#x20;     const memberId = String(item?.userId ?? "");

&#x20;     const profile = userProfileMap?.\[memberId];

&#x20;     const name = String(profile?.fullName ?? memberId).toLowerCase();

&#x20;     return name.includes(normalized) || memberId.toLowerCase().includes(normalized);

&#x20;   });

&#x20; }, \[safePendingMembers, searchText, userProfileMap]);



&#x20; const addableFriendCandidates = useMemo(() => {

&#x20;   const memberSet = new Set(safeMembers);

&#x20;   const pendingMemberSet = new Set(

&#x20;     safePendingMembers

&#x20;       .map((item) => String(item?.userId ?? "").trim())

&#x20;       .filter(Boolean),

&#x20;   );

&#x20;   const myId = currentUserId ?? null;

&#x20;   const normalized = memberPickerSearch.trim().toLowerCase();



&#x20;   return safeFriendContacts

&#x20;     .map((friend, index) => {

&#x20;       const profile = userProfileMap?.\[friend.userId];

&#x20;       const displayName = profile?.fullName ?? `User ${friend.userId.slice(0, 8)}`;

&#x20;       const email = profile?.email ?? "";

&#x20;       return {

&#x20;         userId: friend.userId,

&#x20;         displayName,

&#x20;         email,

&#x20;         avatarUrl: profile?.avatarUrl ?? null,

&#x20;         sortKey: `${displayName}-${friend.userId}-${index}`,

&#x20;       };

&#x20;     })

&#x20;     .filter((candidate) => candidate.userId \&\& candidate.userId !== myId)

&#x20;     .filter((candidate) => !memberSet.has(candidate.userId))

&#x20;     .filter((candidate) => !pendingMemberSet.has(candidate.userId))

&#x20;     .filter((candidate) => {

&#x20;       if (!normalized) {

&#x20;         return true;

&#x20;       }

&#x20;       const name = candidate.displayName.toLowerCase();

&#x20;       const email = candidate.email.toLowerCase();

&#x20;       const id = candidate.userId.toLowerCase();

&#x20;       return (

&#x20;         name.includes(normalized) ||

&#x20;         email.includes(normalized) ||

&#x20;         id.includes(normalized)

&#x20;       );

&#x20;     })

&#x20;     .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

&#x20; }, \[safeFriendContacts, safeMembers, safePendingMembers, currentUserId, memberPickerSearch, userProfileMap]);



&#x20; const mediaItems = useMemo(() => {

&#x20;   return parsedMessages

&#x20;     .filter((item) => {

&#x20;       if (!item.resolvedFileUrl) return false;

&#x20;       if (item.type === "IMAGE" || item.type === "VIDEO" || item.type === "GIF") {

&#x20;         return true;

&#x20;       }

&#x20;       const fileName = String(item.fileName ?? "").toLowerCase();

&#x20;       return /(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);

&#x20;     });

&#x20; }, \[parsedMessages]);



&#x20; const fileItems = useMemo(() => {

&#x20;   return parsedMessages

&#x20;     .filter((item) => {

&#x20;       if (!item.resolvedFileUrl) return false;

&#x20;       if (item.type === "FILE") return true;

&#x20;       const fileName = String(item.fileName ?? "").toLowerCase();

&#x20;       return !/(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);

&#x20;     });

&#x20; }, \[parsedMessages]);



&#x20; const linkItems = useMemo(() => {

&#x20;   const bucket = \[];

&#x20;   parsedMessages.forEach((item) => {

&#x20;     item.links.forEach((link) => {

&#x20;       bucket.push({

&#x20;         id: `${item.id}-${link}`,

&#x20;         senderId: item.senderId,

&#x20;         link,

&#x20;         createdAt: item.createdAt,

&#x20;       });

&#x20;     });

&#x20;   });

&#x20;   return bucket;

&#x20; }, \[parsedMessages]);



&#x20; const previewMediaItems = useMemo(() => mediaItems.slice(0, 8), \[mediaItems]);

&#x20; const previewFileItems = useMemo(() => fileItems.slice(0, 3), \[fileItems]);

&#x20; const previewLinkItems = useMemo(() => linkItems.slice(0, 3), \[linkItems]);



&#x20; const reminderItems = useMemo(() => {

&#x20;   return parsedMessages

&#x20;     .filter((item) => item.type === "REMINDER")

&#x20;     .map((item) => {

&#x20;       const title = String(item.json?.title ?? item.content ?? "").trim();

&#x20;       const eventTime = String(item.json?.when ?? item.json?.eventTime ?? item.createdAt ?? "");

&#x20;       return {

&#x20;         id: item.id,

&#x20;         title: title || (language === "vi" ? "Nhac hen" : "Reminder"),

&#x20;         eventTime,

&#x20;         createdAtMs: item.createdAtMs,

&#x20;       };

&#x20;     })

&#x20;     .sort((left, right) => right.createdAtMs - left.createdAtMs);

&#x20; }, \[parsedMessages, language]);



&#x20; const boardFeedItems = useMemo(() => {

&#x20;   const pinnedItems = safePinnedMessages.map((item) => ({

&#x20;     id: `pin-${item.id}`,

&#x20;     sourceId: item.sourceMessageId,

&#x20;     createdAtMs: item.createdAtMs,

&#x20;     createdAt: new Date(item.createdAtMs || Date.now()).toISOString(),

&#x20;     title: item.title,

&#x20;     preview: item.preview,

&#x20;     itemType: item.itemType,

&#x20;     senderId: null,

&#x20;   }));



&#x20;   const noteItems = parsedMessages

&#x20;     .filter((item) => item.type === "NOTE")

&#x20;     .filter((item) => {

&#x20;       const kind = String(item.json?.kind ?? "").toUpperCase();

&#x20;       return kind === "BOARD\_NOTE";

&#x20;     })

&#x20;     .map((item) => ({

&#x20;       id: `note-${item.id}`,

&#x20;       sourceId: item.id,

&#x20;       createdAtMs: item.createdAtMs,

&#x20;       createdAt: item.createdAt,

&#x20;       title: String(item.json?.title ?? (language === "vi" ? "Ghi chu nhom" : "Group note")),

&#x20;       preview: String(item.json?.note ?? item.json?.preview ?? item.content ?? ""),

&#x20;       itemType: "note",

&#x20;       senderId: item.senderId ?? null,

&#x20;     }));



&#x20;   const pollItems = parsedMessages

&#x20;     .filter((item) => item.type === "POLL")

&#x20;     .filter((item) => String(item.json?.kind ?? "").toUpperCase() === "GROUP\_POLL")

&#x20;     .map((item) => ({

&#x20;       id: `poll-${item.id}`,

&#x20;       sourceId: item.id,

&#x20;       createdAtMs: item.createdAtMs,

&#x20;       createdAt: item.createdAt,

&#x20;       title: String(item.json?.question ?? item.json?.title ?? (language === "vi" ? "Binh chon" : "Poll")),

&#x20;       preview: Array.isArray(item.json?.options)

&#x20;         ? `${item.json.options.length} ${language === "vi" ? "lua chon" : "options"}`

&#x20;         : "",

&#x20;       itemType: "poll",

&#x20;       senderId: item.senderId ?? null,

&#x20;     }));



&#x20;   return \[...pinnedItems, ...noteItems, ...pollItems].sort(

&#x20;     (left, right) => right.createdAtMs - left.createdAtMs,

&#x20;   );

&#x20; }, \[safePinnedMessages, parsedMessages, language]);



&#x20; const boardItemsForView = useMemo(() => {

&#x20;   if (boardTab === "all") {

&#x20;     return boardFeedItems;

&#x20;   }

&#x20;   if (boardTab === "pins") {

&#x20;     return boardFeedItems.filter((item) => item.itemType === "pin");

&#x20;   }

&#x20;   if (boardTab === "notes") {

&#x20;     return boardFeedItems.filter((item) => item.itemType === "note");

&#x20;   }

&#x20;   return boardFeedItems.filter((item) => item.itemType === "poll");

&#x20; }, \[boardFeedItems, boardTab]);



&#x20; const archiveSenderOptions = useMemo(() => {

&#x20;   const senderIds = new Set();

&#x20;   \[...mediaItems, ...fileItems, ...linkItems].forEach((item) => {

&#x20;     if (item.senderId) {

&#x20;       senderIds.add(item.senderId);

&#x20;     }

&#x20;   });

&#x20;   return Array.from(senderIds);

&#x20; }, \[mediaItems, fileItems, linkItems]);



&#x20; const archiveDateOptions = useMemo(() => {

&#x20;   const dateKeys = new Set();

&#x20;   \[...mediaItems, ...fileItems, ...linkItems].forEach((item) => {

&#x20;     const sourceDate = item.createdAt ? new Date(item.createdAt) : null;

&#x20;     if (!sourceDate || Number.isNaN(sourceDate.getTime())) {

&#x20;       return;

&#x20;     }

&#x20;     const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;

&#x20;     dateKeys.add(key);

&#x20;   });

&#x20;   return Array.from(dateKeys).sort((left, right) => (left < right ? 1 : -1));

&#x20; }, \[mediaItems, fileItems, linkItems]);



&#x20; const applyArchiveFilters = (items) => {

&#x20;   return items.filter((item) => {

&#x20;     const senderOk =

&#x20;       archiveSenderFilter === "all" || item.senderId === archiveSenderFilter;

&#x20;     if (!senderOk) {

&#x20;       return false;

&#x20;     }



&#x20;     if (archiveDateFilter === "all") {

&#x20;       return true;

&#x20;     }



&#x20;     const sourceDate = item.createdAt ? new Date(item.createdAt) : null;

&#x20;     if (!sourceDate || Number.isNaN(sourceDate.getTime())) {

&#x20;       return false;

&#x20;     }



&#x20;     const itemKey = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;

&#x20;     return itemKey === archiveDateFilter;

&#x20;   });

&#x20; };



&#x20; const archiveMediaItems = useMemo(

&#x20;   () => applyArchiveFilters(mediaItems),

&#x20;   \[mediaItems, archiveSenderFilter, archiveDateFilter],

&#x20; );

&#x20; const archiveFileItems = useMemo(

&#x20;   () => applyArchiveFilters(fileItems),

&#x20;   \[fileItems, archiveSenderFilter, archiveDateFilter],

&#x20; );

&#x20; const archiveLinkItems = useMemo(

&#x20;   () => applyArchiveFilters(linkItems),

&#x20;   \[linkItems, archiveSenderFilter, archiveDateFilter],

&#x20; );



&#x20; const joinLink = useMemo(() => {

&#x20;   const inviteCode = String(settings?.inviteCode ?? "").trim();

&#x20;   if (!inviteCode) {

&#x20;     return "";

&#x20;   }

&#x20;   const origin = typeof window !== "undefined" ? window.location.origin : "";

&#x20;   return `${origin}/chat?groupInvite=${encodeURIComponent(inviteCode)}`;

&#x20; }, \[settings?.inviteCode]);



&#x20; const toggleSection = (key) => {

&#x20;   setOpenSections((prev) => ({

&#x20;     ...prev,

&#x20;     \[key]: !prev\[key],

&#x20;   }));

&#x20; };



&#x20; const copyJoinLink = async () => {

&#x20;   if (!joinLink) {

&#x20;     return;

&#x20;   }

&#x20;   try {

&#x20;     await navigator.clipboard.writeText(joinLink);

&#x20;   } catch {

&#x20;     // Ignore clipboard errors.

&#x20;   }

&#x20; };



&#x20; const openMemberPicker = () => {

&#x20;   if (!canInviteMembers) {

&#x20;     return;

&#x20;   }

&#x20;   setMemberPickerSearch("");

&#x20;   setSelectedMemberIds(\[]);

&#x20;   setIsMemberPickerOpen(true);

&#x20; };



&#x20; const closeMemberPicker = () => {

&#x20;   if (isAddingMembers) {

&#x20;     return;

&#x20;   }

&#x20;   setIsMemberPickerOpen(false);

&#x20;   setMemberPickerSearch("");

&#x20;   setSelectedMemberIds(\[]);

&#x20; };



&#x20; const toggleCandidate = (userId) => {

&#x20;   setSelectedMemberIds((current) => {

&#x20;     if (current.includes(userId)) {

&#x20;       return current.filter((id) => id !== userId);

&#x20;     }

&#x20;     return \[...current, userId];

&#x20;   });

&#x20; };



&#x20; const submitAddMembers = async () => {

&#x20;   if (selectedMemberIds.length === 0 || !onAddMembers) {

&#x20;     return;

&#x20;   }

&#x20;   const completed = await onAddMembers(selectedMemberIds);

&#x20;   if (completed !== false) {

&#x20;     closeMemberPicker();

&#x20;   }

&#x20; };



&#x20; const submitBoardNote = async () => {

&#x20;   const trimmed = noteDraft.trim();

&#x20;   if (!trimmed) {

&#x20;     return;

&#x20;   }



&#x20;   await onCreateBoardNote?.(trimmed, isNotePinnedToTop);

&#x20;   setNoteDraft("");

&#x20;   setIsNotePinnedToTop(true);

&#x20;   setIsCreateNoteOpen(false);

&#x20; };



&#x20; const updatePollOption = (index, value) => {

&#x20;   setPollOptionDrafts((prev) => prev.map((item, currentIndex) => (currentIndex === index ? value : item)));

&#x20; };



&#x20; const addPollOption = () => {

&#x20;   setPollOptionDrafts((prev) => {

&#x20;     if (prev.length >= 10) {

&#x20;       return prev;

&#x20;     }

&#x20;     return \[...prev, ""];

&#x20;   });

&#x20; };



&#x20; const removePollOption = (index) => {

&#x20;   setPollOptionDrafts((prev) => {

&#x20;     if (prev.length <= 2) {

&#x20;       return prev;

&#x20;     }

&#x20;     return prev.filter((\_, currentIndex) => currentIndex !== index);

&#x20;   });

&#x20; };



&#x20; const resetPollDraft = () => {

&#x20;   setPollQuestionDraft("");

&#x20;   setPollOptionDrafts(\["", ""]);

&#x20;   setIsPollMultiChoice(false);

&#x20;   setIsPollAllowChangeVote(true);

&#x20;   setPollDeadlineMinutes(1440);

&#x20;   setIsPollHideResultsBeforeVote(false);

&#x20;   setIsCreatePollOpen(false);

&#x20; };



&#x20; const submitCreatePoll = async () => {

&#x20;   const cleanedOptions = pollOptionDrafts

&#x20;     .map((option) => option.trim())

&#x20;     .filter((option) => option.length > 0);



&#x20;   const completed = await onCreatePoll?.({

&#x20;     question: pollQuestionDraft.trim(),

&#x20;     options: cleanedOptions,

&#x20;     multipleChoice: isPollMultiChoice,

&#x20;     allowChangeVote: isPollAllowChangeVote,

&#x20;     deadlineMinutes: pollDeadlineMinutes,

&#x20;     hideResultsBeforeVote: isPollHideResultsBeforeVote,

&#x20;   });



&#x20;   if (completed !== false) {

&#x20;     resetPollDraft();

&#x20;   }

&#x20; };



&#x20; const submitCreateReminder = async () => {

&#x20;   const trimmedTitle = reminderTitleDraft.trim();

&#x20;   if (!trimmedTitle) {

&#x20;     return;

&#x20;   }



&#x20;   const completed = onCreateReminder

&#x20;     ? await onCreateReminder({

&#x20;       title: trimmedTitle,

&#x20;       when: reminderTimeDraft || null,

&#x20;     })

&#x20;     : await onSendTemplateMessage?.("REMINDER");



&#x20;   if (completed !== false) {

&#x20;     setReminderTitleDraft("");

&#x20;     setReminderTimeDraft("");

&#x20;     setIsCreateReminderOpen(false);

&#x20;   }

&#x20; };



&#x20; const saveHeaderGroupName = async () => {

&#x20;   const trimmed = nameDraft.trim();

&#x20;   if (!trimmed) {

&#x20;     return;

&#x20;   }

&#x20;   const completed = await onSaveGroupName?.(trimmed);

&#x20;   if (completed !== false) {

&#x20;     setIsHeaderEditOpen(false);

&#x20;   }

&#x20; };



&#x20; const triggerAvatarSelect = () => {

&#x20;   if (!canEditGroupProfile || isUpdatingGroupProfile) {

&#x20;     return;

&#x20;   }

&#x20;   avatarInputRef.current?.click?.();

&#x20; };



&#x20; const onAvatarInputChanged = async (event) => {

&#x20;   const file = event.target.files?.\[0] ?? null;

&#x20;   if (!file) {

&#x20;     return;

&#x20;   }

&#x20;   await onSelectGroupAvatar?.(file);

&#x20;   event.target.value = "";

&#x20; };



&#x20; const renderMemberTag = (memberId) => {

&#x20;   if (memberId === ownerId) {

&#x20;     return language === "vi" ? "Truong nhom" : "Owner";

&#x20;   }

&#x20;   if (adminIds.includes(memberId)) {

&#x20;     return language === "vi" ? "Pho nhom" : "Admin";

&#x20;   }

&#x20;   return language === "vi" ? "Thanh vien" : "Member";

&#x20; };



&#x20; const iconActionBase =

&#x20;   "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-\[11px] transition";



&#x20; const openBoardView = () => setPanelView("board");

&#x20; const openMembersView = () => setPanelView("members");

&#x20; const openReminderView = () => setPanelView("reminders");

&#x20; const openArchiveView = (tab) => {

&#x20;   setArchiveTab(tab);

&#x20;   setPanelView("archive");

&#x20; };

&#x20; const backToDefaultPanel = () => setPanelView("default");



&#x20; return (

&#x20;   <div className="flex h-full min-h-0">

&#x20;     <div className="min-w-0 flex flex-1 flex-col overflow-hidden">{children}</div>



&#x20;     <aside

&#x20;       className={`hidden w-\[24rem] shrink-0 border-l border-\[#1f4673] bg-\[#0d2442] lg:flex lg:flex-col ${isPanelOpen ? "" : "lg:hidden"}`}

&#x20;     >

&#x20;       <div className="border-b border-\[#1f4673] px-4 py-4">

&#x20;         <p className="text-center text-2xl font-bold text-slate-100">

&#x20;           {language === "vi" ? "Thong tin nhom" : "Group details"}

&#x20;         </p>



&#x20;         <div className="mt-4 flex flex-col items-center">

&#x20;           <input

&#x20;             ref={avatarInputRef}

&#x20;             type="file"

&#x20;             accept="image/\*"

&#x20;             onChange={(event) => {

&#x20;               void onAvatarInputChanged(event);

&#x20;             }}

&#x20;             className="hidden"

&#x20;           />



&#x20;           <button

&#x20;             type="button"

&#x20;             onClick={triggerAvatarSelect}

&#x20;             disabled={!canEditGroupProfile || isUpdatingGroupProfile}

&#x20;             className={`group relative rounded-full ${canEditGroupProfile ? "cursor-pointer" : "cursor-default"}`}

&#x20;             title={

&#x20;               canEditGroupProfile

&#x20;                 ? language === "vi"

&#x20;                   ? "Doi anh nhom"

&#x20;                   : "Change group avatar"

&#x20;                 : undefined

&#x20;             }

&#x20;           >

&#x20;             {resolvedConversationAvatar ? (

&#x20;               <img

&#x20;                 src={resolvedConversationAvatar}

&#x20;                 alt={conversation?.name ?? "Group"}

&#x20;                 className="h-\[5.5rem] w-\[5.5rem] rounded-full border-2 border-slate-500/70 object-cover object-center shadow-lg"

&#x20;               />

&#x20;             ) : (

&#x20;               <div className="grid h-\[5.5rem] w-\[5.5rem] place-items-center rounded-full bg-sky-500/25 text-xl font-bold text-sky-100">

&#x20;                 {initials(conversation?.name ?? "Group")}

&#x20;               </div>

&#x20;             )}

&#x20;             {canEditGroupProfile \&\& (

&#x20;               <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition group-hover:bg-black/20" />

&#x20;             )}

&#x20;           </button>



&#x20;           {isHeaderEditOpen ? (

&#x20;             <div className="mt-3 w-full space-y-2">

&#x20;               <input

&#x20;                 type="text"

&#x20;                 value={nameDraft}

&#x20;                 onChange={(event) => setNameDraft(event.target.value)}

&#x20;                 placeholder={language === "vi" ? "Ten nhom" : "Group name"}

&#x20;                 className="h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100"

&#x20;               />

&#x20;               <div className="flex items-center justify-center gap-2">

&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={() => {

&#x20;                     setNameDraft(conversation?.name ?? "");

&#x20;                     setIsHeaderEditOpen(false);

&#x20;                   }}

&#x20;                   className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"

&#x20;                 >

&#x20;                   {language === "vi" ? "Huy" : "Cancel"}

&#x20;                 </button>

&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={() => {

&#x20;                     void saveHeaderGroupName();

&#x20;                   }}

&#x20;                   disabled={isUpdatingGroupProfile || !nameDraft.trim()}

&#x20;                   className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;                 >

&#x20;                   {language === "vi" ? "Luu ten" : "Save name"}

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>

&#x20;           ) : (

&#x20;             <button

&#x20;               type="button"

&#x20;               disabled={!canEditGroupProfile}

&#x20;               onClick={() => {

&#x20;                 if (canEditGroupProfile) {

&#x20;                   setIsHeaderEditOpen(true);

&#x20;                 }

&#x20;               }}

&#x20;               className={`mt-3 text-center text-4xl font-semibold text-slate-100 ${canEditGroupProfile ? "cursor-pointer hover:text-sky-200" : "cursor-default"}`}

&#x20;             >

&#x20;               {conversation?.name ?? (language === "vi" ? "Nhom" : "Group")}

&#x20;             </button>

&#x20;           )}



&#x20;           <p className="mt-1 text-xs text-slate-400">

&#x20;             {language === "vi" ? "Cong dong" : "Community"}

&#x20;           </p>

&#x20;           {canEditGroupProfile \&\& (

&#x20;             <div className="mt-2 flex items-center gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={triggerAvatarSelect}

&#x20;                 disabled={isUpdatingGroupProfile}

&#x20;                 className="rounded-lg border border-slate-600 px-2 py-1 text-\[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;               >

&#x20;                 {isUpdatingGroupProfile

&#x20;                   ? language === "vi"

&#x20;                     ? "Dang cap nhat..."

&#x20;                     : "Updating..."

&#x20;                   : language === "vi"

&#x20;                     ? "Doi anh"

&#x20;                     : "Change avatar"}

&#x20;               </button>

&#x20;             </div>

&#x20;           )}

&#x20;         </div>



&#x20;         <div className="mt-4 grid grid-cols-4 gap-2">

&#x20;           <button

&#x20;             type="button"

&#x20;             onClick={() => onPreferenceChange?.({ muted: !Boolean(preferences?.muted) })}

&#x20;             className={`${iconActionBase} ${preferences?.muted ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}

&#x20;           >

&#x20;             <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">

&#x20;               <BellOff size={14} />

&#x20;             </span>

&#x20;             <span>{language === "vi" ? "Bat thong bao" : "Notify"}</span>

&#x20;           </button>



&#x20;           <button

&#x20;             type="button"

&#x20;             onClick={() => onPreferenceChange?.({ pinned: !Boolean(preferences?.pinned) })}

&#x20;             className={`${iconActionBase} ${preferences?.pinned ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}

&#x20;           >

&#x20;             <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">

&#x20;               <Pin size={14} />

&#x20;             </span>

&#x20;             <span>{language === "vi" ? "Ghim hoi thoai" : "Pin"}</span>

&#x20;           </button>



&#x20;           <button

&#x20;             type="button"

&#x20;             disabled={!canInviteMembers}

&#x20;             onClick={openMemberPicker}

&#x20;             className={`${iconActionBase} ${canInviteMembers ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}

&#x20;           >

&#x20;             <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">

&#x20;               <UserPlus size={14} />

&#x20;             </span>

&#x20;             <span>{language === "vi" ? "Them thanh vien" : "Add member"}</span>

&#x20;           </button>



&#x20;           <button

&#x20;             type="button"

&#x20;             disabled={!canOpenManage}

&#x20;             onClick={() => setManageMode((prev) => !prev)}

&#x20;             className={`${iconActionBase} ${canOpenManage ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}

&#x20;           >

&#x20;             <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">

&#x20;               <Settings size={14} />

&#x20;             </span>

&#x20;             <span>{language === "vi" ? "Quan ly nhom" : "Manage"}</span>

&#x20;           </button>

&#x20;         </div>



&#x20;         {!canOpenManage \&\& (

&#x20;           <p className="mt-2 text-center text-\[11px] text-amber-300">

&#x20;             {language === "vi"

&#x20;               ? "Chi Truong/Pho nhom moi vao duoc phan Quan ly nhom"

&#x20;               : "Only owner/admin can access group management"}

&#x20;           </p>

&#x20;         )}

&#x20;       </div>



&#x20;       <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">

&#x20;         {!manageMode \&\& panelView === "default" \&\& (

&#x20;           <>

&#x20;             <Section

&#x20;               title={language === "vi" ? "Thanh vien nhom" : "Members"}

&#x20;               open={openSections.members}

&#x20;               onToggle={() => toggleSection("members")}

&#x20;             >

&#x20;               <div className="space-y-2 text-sm text-slate-200">

&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={openMembersView}

&#x20;                   className="flex items-center gap-2 rounded-lg bg-slate-900/35 px-2 py-1.5 hover:bg-slate-800"

&#x20;                 >

&#x20;                   <Users size={16} className="text-slate-300" />

&#x20;                   <span>

&#x20;                     {safeMembers.length} {language === "vi" ? "thanh vien" : "members"}

&#x20;                   </span>

&#x20;                 </button>



&#x20;                 <div className="rounded-xl bg-slate-900/45 p-2">

&#x20;                   <div className="flex items-center justify-between gap-2">

&#x20;                     <div className="min-w-0">

&#x20;                       <p className="text-xs text-slate-300">

&#x20;                         {language === "vi" ? "Link tham gia nhom" : "Join link"}

&#x20;                       </p>

&#x20;                       {joinLink ? (

&#x20;                         <a

&#x20;                           href={joinLink}

&#x20;                           target="\_blank"

&#x20;                           rel="noreferrer"

&#x20;                           className="block truncate text-sm font-semibold text-sky-300 underline decoration-sky-400/60 underline-offset-2"

&#x20;                         >

&#x20;                           {joinLink}

&#x20;                         </a>

&#x20;                       ) : (

&#x20;                         <p className="truncate text-sm font-semibold text-sky-300">

&#x20;                           {language === "vi" ? "Dang tao link..." : "Generating link..."}

&#x20;                         </p>

&#x20;                       )}

&#x20;                     </div>

&#x20;                     <div className="flex items-center gap-1">

&#x20;                       <a

&#x20;                         href={joinLink || undefined}

&#x20;                         target="\_blank"

&#x20;                         rel="noreferrer"

&#x20;                         aria-disabled={!joinLink}

&#x20;                         className={`grid h-8 w-8 place-items-center rounded-lg ${joinLink ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "pointer-events-none bg-slate-800/60 text-slate-500"}`}

&#x20;                       >

&#x20;                         <ExternalLink size={14} />

&#x20;                       </a>

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={copyJoinLink}

&#x20;                         disabled={!joinLink}

&#x20;                         className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"

&#x20;                       >

&#x20;                         <Copy size={14} />

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 </div>

&#x20;               </div>

&#x20;             </Section>



&#x20;             <Section

&#x20;               title={language === "vi" ? "Bang tin nhom" : "Board"}

&#x20;               open={openSections.board}

&#x20;               onToggle={() => toggleSection("board")}

&#x20;             >

&#x20;               <div className="space-y-2 text-sm text-slate-200">

&#x20;                 <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2">

&#x20;                   <div className="mb-1 flex items-center justify-between gap-2">

&#x20;                     <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">

&#x20;                       {language === "vi" ? "Danh sach ghim va ghi chu" : "Pinned \& notes"}

&#x20;                     </p>

&#x20;                     <span className="text-\[11px] text-amber-100">{safePinnedMessages.length}</span>

&#x20;                   </div>



&#x20;                   {safePinnedMessages.length === 0 ? (

&#x20;                     <p className="text-xs text-amber-100/80">

&#x20;                       {language === "vi" ? "Chua co tin nhan nao duoc ghim" : "No pinned messages yet"}

&#x20;                     </p>

&#x20;                   ) : (

&#x20;                     <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">

&#x20;                       {safePinnedMessages.slice(0, 15).map((item) => (

&#x20;                         <div

&#x20;                           key={item.id}

&#x20;                           role="button"

&#x20;                           tabIndex={0}

&#x20;                           onClick={() => onOpenPinnedMessage?.(item.sourceMessageId)}

&#x20;                           onKeyDown={(event) => {

&#x20;                             if (event.key === "Enter" || event.key === " ") {

&#x20;                               event.preventDefault();

&#x20;                               onOpenPinnedMessage?.(item.sourceMessageId);

&#x20;                             }

&#x20;                           }}

&#x20;                           className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/15 px-2 py-1.5 text-left hover:bg-black/30"

&#x20;                         >

&#x20;                           <div className="min-w-0">

&#x20;                             <p className="truncate text-\[11px] font-semibold text-amber-100">

&#x20;                               <span className="mr-1 inline-flex align-middle">

&#x20;                                 {item.itemType === "note" ? <FileText size={12} /> : <Pin size={12} />}

&#x20;                               </span>

&#x20;                               <span className="align-middle">{item.title}</span>

&#x20;                             </p>

&#x20;                             {item.preview \&\& (

&#x20;                               <p className="truncate text-\[10px] text-amber-100/85">{item.preview}</p>

&#x20;                             )}

&#x20;                           </div>

&#x20;                           <span className="shrink-0">

&#x20;                             <button

&#x20;                               type="button"

&#x20;                               disabled={!canPinBoardItems}

&#x20;                               onClick={(event) => {

&#x20;                                 event.stopPropagation();

&#x20;                                 if (canPinBoardItems) {

&#x20;                                   onUnpinPinnedMessage?.(item.sourceMessageId);

&#x20;                                 }

&#x20;                               }}

&#x20;                               className={`rounded-md border border-rose-300/40 px-2 py-1 text-\[10px] font-semibold ${canPinBoardItems ? "bg-rose-500/10 text-rose-100 hover:bg-rose-500/20" : "bg-slate-800/60 text-slate-500"}`}

&#x20;                             >

&#x20;                               {language === "vi" ? "Bo ghim" : "Unpin"}

&#x20;                             </button>

&#x20;                           </span>

&#x20;                         </div>

&#x20;                       ))}

&#x20;                     </div>

&#x20;                   )}

&#x20;                 </div>



&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={openReminderView}

&#x20;                   className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"

&#x20;                 >

&#x20;                   <Newspaper size={16} className="text-slate-300" />

&#x20;                   <span>{language === "vi" ? "Danh sach nhac hen" : "Reminder list"}</span>

&#x20;                 </button>

&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={openBoardView}

&#x20;                   className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"

&#x20;                 >

&#x20;                   <FileText size={16} className="text-slate-300" />

&#x20;                   <span>{language === "vi" ? "Ghi chu, ghim, binh chon" : "Notes, pins, polls"}</span>

&#x20;                 </button>



&#x20;                 <button

&#x20;                   type="button"

&#x20;                   disabled={!canCreatePolls}

&#x20;                   onClick={() => setIsCreatePollOpen(true)}

&#x20;                   className={`flex w-full items-center gap-2 rounded-xl border border-sky-400/30 px-3 py-2 text-left ${canCreatePolls ? "bg-sky-500/10 hover:bg-sky-500/15" : "bg-slate-800/60 text-slate-500"}`}

&#x20;                 >

&#x20;                   <Newspaper size={16} className="text-sky-200" />

&#x20;                   <span>{language === "vi" ? "Tao binh chon" : "Create poll"}</span>

&#x20;                 </button>



&#x20;                 {!canCreatePolls \&\& (

&#x20;                   <p className="text-\[11px] text-amber-300">

&#x20;                     {language === "vi"

&#x20;                       ? "Ban khong duoc phep tao binh chon"

&#x20;                       : "You are not allowed to create polls"}

&#x20;                   </p>

&#x20;                 )}



&#x20;                 {false \&\& isCreatePollOpen \&\& (

&#x20;                   <div className="rounded-xl border border-sky-300/30 bg-\[#101b28] p-2.5">

&#x20;                     <input

&#x20;                       type="text"

&#x20;                       value={pollQuestionDraft}

&#x20;                       onChange={(event) => setPollQuestionDraft(event.target.value)}

&#x20;                       maxLength={200}

&#x20;                       placeholder={language === "vi" ? "Nhap cau hoi binh chon" : "Enter poll question"}

&#x20;                       className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"

&#x20;                     />



&#x20;                     <div className="mt-2 space-y-1.5">

&#x20;                       {pollOptionDrafts.map((option, index) => (

&#x20;                         <div key={`poll-option-${index}`} className="flex items-center gap-1.5">

&#x20;                           <input

&#x20;                             type="text"

&#x20;                             value={option}

&#x20;                             onChange={(event) => updatePollOption(index, event.target.value)}

&#x20;                             maxLength={80}

&#x20;                             placeholder={language === "vi" ? `Lua chon ${index + 1}` : `Option ${index + 1}`}

&#x20;                             className="h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-xs text-slate-100"

&#x20;                           />

&#x20;                           <button

&#x20;                             type="button"

&#x20;                             disabled={pollOptionDrafts.length <= 2}

&#x20;                             onClick={() => removePollOption(index)}

&#x20;                             className="rounded-md border border-rose-400/40 px-2 py-1 text-\[10px] font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"

&#x20;                           >

&#x20;                             {language === "vi" ? "Xoa" : "Remove"}

&#x20;                           </button>

&#x20;                         </div>

&#x20;                       ))}

&#x20;                     </div>



&#x20;                     <button

&#x20;                       type="button"

&#x20;                       disabled={pollOptionDrafts.length >= 10}

&#x20;                       onClick={addPollOption}

&#x20;                       className="mt-2 rounded-md border border-sky-300/40 px-2 py-1 text-\[11px] font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"

&#x20;                     >

&#x20;                       {language === "vi" ? "Them lua chon" : "Add option"}

&#x20;                     </button>



&#x20;                     <div className="mt-2 space-y-1">

&#x20;                       <label className="block text-xs text-slate-200">

&#x20;                         <span>{language === "vi" ? "Han binh chon" : "Poll deadline"}</span>

&#x20;                         <select

&#x20;                           value={pollDeadlineMinutes}

&#x20;                           onChange={(event) => setPollDeadlineMinutes(Number(event.target.value))}

&#x20;                           className="mt-1 h-8 w-full rounded-md border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"

&#x20;                         >

&#x20;                           <option value={30}>{language === "vi" ? "30 phut" : "30 minutes"}</option>

&#x20;                           <option value={60}>{language === "vi" ? "1 gio" : "1 hour"}</option>

&#x20;                           <option value={180}>{language === "vi" ? "3 gio" : "3 hours"}</option>

&#x20;                           <option value={720}>{language === "vi" ? "12 gio" : "12 hours"}</option>

&#x20;                           <option value={1440}>{language === "vi" ? "1 ngay" : "1 day"}</option>

&#x20;                           <option value={4320}>{language === "vi" ? "3 ngay" : "3 days"}</option>

&#x20;                           <option value={10080}>{language === "vi" ? "7 ngay" : "7 days"}</option>

&#x20;                         </select>

&#x20;                       </label>

&#x20;                       <label className="inline-flex items-center gap-2 text-xs text-slate-200">

&#x20;                         <input

&#x20;                           type="checkbox"

&#x20;                           checked={isPollMultiChoice}

&#x20;                           onChange={(event) => setIsPollMultiChoice(event.target.checked)}

&#x20;                           className="h-4 w-4 accent-sky-500"

&#x20;                         />

&#x20;                         <span>{language === "vi" ? "Cho phep chon nhieu dap an" : "Allow multiple choices"}</span>

&#x20;                       </label>

&#x20;                       <label className="inline-flex items-center gap-2 text-xs text-slate-200">

&#x20;                         <input

&#x20;                           type="checkbox"

&#x20;                           checked={isPollAllowChangeVote}

&#x20;                           onChange={(event) => setIsPollAllowChangeVote(event.target.checked)}

&#x20;                           className="h-4 w-4 accent-sky-500"

&#x20;                         />

&#x20;                         <span>{language === "vi" ? "Cho phep doi lua chon" : "Allow changing vote"}</span>

&#x20;                       </label>

&#x20;                       <label className="inline-flex items-center gap-2 text-xs text-slate-200">

&#x20;                         <input

&#x20;                           type="checkbox"

&#x20;                           checked={isPollHideResultsBeforeVote}

&#x20;                           onChange={(event) => setIsPollHideResultsBeforeVote(event.target.checked)}

&#x20;                           className="h-4 w-4 accent-sky-500"

&#x20;                         />

&#x20;                         <span>{language === "vi" ? "An ket qua truoc khi bo phieu" : "Hide results before voting"}</span>

&#x20;                       </label>

&#x20;                     </div>



&#x20;                     <div className="mt-2 flex items-center justify-end gap-2">

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={resetPollDraft}

&#x20;                         className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"

&#x20;                       >

&#x20;                         {language === "vi" ? "Huy" : "Cancel"}

&#x20;                       </button>

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={() => {

&#x20;                           void submitCreatePoll();

&#x20;                         }}

&#x20;                         disabled={!pollQuestionDraft.trim()}

&#x20;                         className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;                       >

&#x20;                         {language === "vi" ? "Tao binh chon" : "Create poll"}

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 )}



&#x20;                 <button

&#x20;                   type="button"

&#x20;                   onClick={() => setIsCreateNoteOpen(true)}

&#x20;                   disabled={!canCreateNotes}

&#x20;                   className={`flex w-full items-center gap-2 rounded-xl border border-lime-400/30 px-3 py-2 text-left ${canCreateNotes ? "bg-lime-500/10 hover:bg-lime-500/15" : "bg-slate-800/60 text-slate-500"}`}

&#x20;                 >

&#x20;                   <FileText size={16} className="text-lime-200" />

&#x20;                   <span>{language === "vi" ? "Tao ghi chu nhom" : "Create group note"}</span>

&#x20;                 </button>



&#x20;                 {false \&\& isCreateNoteOpen \&\& (

&#x20;                   <div className="rounded-xl border border-lime-300/30 bg-\[#101b28] p-2.5">

&#x20;                     <textarea

&#x20;                       value={noteDraft}

&#x20;                       onChange={(event) => setNoteDraft(event.target.value)}

&#x20;                       placeholder={language === "vi" ? "Nhap noi dung ghi chu..." : "Enter note content..."}

&#x20;                       rows={3}

&#x20;                       className="w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 text-sm text-slate-100"

&#x20;                     />

&#x20;                     <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-200">

&#x20;                       <input

&#x20;                         type="checkbox"

&#x20;                         checked={isNotePinnedToTop}

&#x20;                         onChange={(event) => setIsNotePinnedToTop(event.target.checked)}

&#x20;                         className="h-4 w-4 accent-lime-500"

&#x20;                       />

&#x20;                       <span>

&#x20;                         {language === "vi"

&#x20;                           ? "Ghim len dau tro chuyen"

&#x20;                           : "Pin to top of conversation"}

&#x20;                       </span>

&#x20;                     </label>

&#x20;                     <div className="mt-2 flex items-center justify-end gap-2">

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={() => {

&#x20;                           setIsCreateNoteOpen(false);

&#x20;                           setNoteDraft("");

&#x20;                           setIsNotePinnedToTop(true);

&#x20;                         }}

&#x20;                         className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"

&#x20;                       >

&#x20;                         {language === "vi" ? "Huy" : "Cancel"}

&#x20;                       </button>

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={() => {

&#x20;                           void submitBoardNote();

&#x20;                         }}

&#x20;                         disabled={!noteDraft.trim()}

&#x20;                         className="rounded-md bg-lime-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;                       >

&#x20;                         {language === "vi" ? "Tao ghi chu" : "Create note"}

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 )}

&#x20;               </div>

&#x20;             </Section>



&#x20;             <Section

&#x20;               title={language === "vi" ? "Anh/Video" : "Media"}

&#x20;               open={openSections.media}

&#x20;               onToggle={() => toggleSection("media")}

&#x20;             >

&#x20;               {mediaItems.length === 0 ? (

&#x20;                 <p className="text-xs text-slate-400">

&#x20;                   {language === "vi" ? "Chua co media duoc chia se" : "No media shared yet"}

&#x20;                 </p>

&#x20;               ) : (

&#x20;                 <div className="grid grid-cols-4 gap-2">

&#x20;                   {previewMediaItems.map((item) => (

&#x20;                     <a

&#x20;                       key={item.id}

&#x20;                       href={item.resolvedFileUrl}

&#x20;                       target="\_blank"

&#x20;                       rel="noreferrer"

&#x20;                       className="group relative block overflow-hidden rounded-lg border border-slate-700"

&#x20;                     >

&#x20;                       {item.type === "VIDEO" ? (

&#x20;                         <div className="grid h-16 place-items-center bg-slate-900 text-slate-300">

&#x20;                           <ImageIcon size={16} />

&#x20;                         </div>

&#x20;                       ) : (

&#x20;                         <img

&#x20;                           src={item.resolvedFileUrl}

&#x20;                           alt={item.fileName ?? "media"}

&#x20;                           className="h-16 w-full object-cover"

&#x20;                         />

&#x20;                       )}

&#x20;                     </a>

&#x20;                   ))}

&#x20;                 </div>

&#x20;               )}

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => openArchiveView("media")}

&#x20;                 className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"

&#x20;               >

&#x20;                 {language === "vi" ? "Xem tat ca" : "View all"}

&#x20;               </button>

&#x20;             </Section>



&#x20;             <Section

&#x20;               title="File"

&#x20;               open={openSections.files}

&#x20;               onToggle={() => toggleSection("files")}

&#x20;             >

&#x20;               {fileItems.length === 0 ? (

&#x20;                 <p className="text-xs text-slate-400">

&#x20;                   {language === "vi"

&#x20;                     ? "Chua co File duoc chia se trong hoi thoai nay"

&#x20;                     : "No files shared in this conversation"}

&#x20;                 </p>

&#x20;               ) : (

&#x20;                 <div className="space-y-2">

&#x20;                   {previewFileItems.map((item) => (

&#x20;                     <a

&#x20;                       key={item.id}

&#x20;                       href={item.resolvedFileUrl}

&#x20;                       target="\_blank"

&#x20;                       rel="noreferrer"

&#x20;                       className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800"

&#x20;                     >

&#x20;                       <div className="min-w-0">

&#x20;                         <p className="truncate text-sm font-semibold text-slate-100">

&#x20;                           {item.fileName ?? item.resolvedFileUrl}

&#x20;                         </p>

&#x20;                         <p className="text-\[11px] text-slate-400">{formatShortDate(item.createdAt)}</p>

&#x20;                       </div>

&#x20;                       <FileText size={16} className="text-slate-300" />

&#x20;                     </a>

&#x20;                   ))}

&#x20;                 </div>

&#x20;               )}

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => openArchiveView("files")}

&#x20;                 className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"

&#x20;               >

&#x20;                 {language === "vi" ? "Xem tat ca" : "View all"}

&#x20;               </button>

&#x20;             </Section>



&#x20;             <Section

&#x20;               title="Link"

&#x20;               open={openSections.links}

&#x20;               onToggle={() => toggleSection("links")}

&#x20;             >

&#x20;               {linkItems.length === 0 ? (

&#x20;                 <p className="text-xs text-slate-400">

&#x20;                   {language === "vi" ? "Chua co link duoc chia se" : "No links shared yet"}

&#x20;                 </p>

&#x20;               ) : (

&#x20;                 <div className="space-y-2">

&#x20;                   {previewLinkItems.map((item) => (

&#x20;                     <a

&#x20;                       key={item.id}

&#x20;                       href={item.link}

&#x20;                       target="\_blank"

&#x20;                       rel="noreferrer"

&#x20;                       className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800"

&#x20;                     >

&#x20;                       <div className="min-w-0">

&#x20;                         <p className="truncate text-sm font-semibold text-slate-100">{item.link}</p>

&#x20;                         <p className="text-\[11px] text-sky-300">{toDomain(item.link)}</p>

&#x20;                       </div>

&#x20;                       <div className="text-\[11px] text-slate-400">{formatShortDate(item.createdAt)}</div>

&#x20;                     </a>

&#x20;                   ))}

&#x20;                 </div>

&#x20;               )}

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => openArchiveView("links")}

&#x20;                 className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"

&#x20;               >

&#x20;                 {language === "vi" ? "Xem tat ca" : "View all"}

&#x20;               </button>

&#x20;             </Section>



&#x20;             <Section

&#x20;               title={language === "vi" ? "Thiet lap bao mat" : "Security settings"}

&#x20;               open={openSections.security}

&#x20;               onToggle={() => toggleSection("security")}

&#x20;             >

&#x20;               <div className="space-y-2 text-sm text-slate-200">

&#x20;                 <div className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">

&#x20;                   <div className="flex items-center gap-2">

&#x20;                     <Shield size={15} className="text-slate-300" />

&#x20;                     <span>{language === "vi" ? "Tin nhan tu xoa" : "Self-destruct"}</span>

&#x20;                   </div>

&#x20;                   <span className="text-xs text-slate-400">

&#x20;                     {language === "vi" ? "Khong bao gio" : "Never"}

&#x20;                   </span>

&#x20;                 </div>



&#x20;                 <label className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">

&#x20;                   <div className="flex items-center gap-2">

&#x20;                     <AlertTriangle size={15} className="text-slate-300" />

&#x20;                     <span>{language === "vi" ? "An tro chuyen" : "Hide conversation"}</span>

&#x20;                   </div>

&#x20;                   <input

&#x20;                     type="checkbox"

&#x20;                     checked={Boolean(preferences?.hidden)}

&#x20;                     onChange={(event) => onPreferenceChange?.({ hidden: event.target.checked })}

&#x20;                   />

&#x20;                 </label>

&#x20;               </div>

&#x20;             </Section>

&#x20;           </>

&#x20;         )}



&#x20;         {!manageMode \&\& panelView === "members" \&\& (

&#x20;           <section className="rounded-2xl border border-\[#2a4b73] bg-\[#0f294a] p-3">

&#x20;             <div className="mb-3 flex items-center justify-between gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={backToDefaultPanel}

&#x20;                 className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-\[#14365f]"

&#x20;               >

&#x20;                 <ArrowLeft size={15} />

&#x20;                 <span>{language === "vi" ? "Quay lai" : "Back"}</span>

&#x20;               </button>

&#x20;               <h3 className="text-base font-semibold text-slate-100">

&#x20;                 {language === "vi" ? `Thanh vien (${safeMembers.length})` : `Members (${safeMembers.length})`}

&#x20;               </h3>

&#x20;               <span className="w-8" />

&#x20;             </div>



&#x20;             <div className="space-y-3">

&#x20;               <input

&#x20;                 type="text"

&#x20;                 value={searchText}

&#x20;                 onChange={(event) => setSearchText(event.target.value)}

&#x20;                 placeholder={language === "vi" ? "Tim kiem thanh vien" : "Search members"}

&#x20;                 className="h-10 w-full rounded-xl border border-\[#335b89] bg-\[#0a1b34] px-3 text-sm text-slate-100 placeholder:text-slate-500"

&#x20;               />



&#x20;               {canInviteMembers \&\& (

&#x20;                 <div className="flex items-center justify-between gap-2 rounded-xl border border-\[#2a4b73] bg-\[#0a1f3d] px-3 py-2.5">

&#x20;                   <p className="text-xs font-medium text-slate-300">

&#x20;                     {language === "vi" ? "Them tu danh sach ban be" : "Add from friend list"}

&#x20;                   </p>

&#x20;                   <button

&#x20;                     type="button"

&#x20;                     onClick={openMemberPicker}

&#x20;                     className="rounded-xl bg-\[#1f8cff] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-\[#1578e2]"

&#x20;                   >

&#x20;                     {language === "vi" ? "Chon" : "Select"}

&#x20;                   </button>

&#x20;                 </div>

&#x20;               )}



&#x20;               <div ref={memberListScrollRef} className="max-h-\[55vh] space-y-2.5 overflow-y-auto pr-1">

&#x20;                 {filteredPendingMembers.length > 0 \&\& (

&#x20;                   <div className="space-y-2">

&#x20;                     <div className="px-1 text-\[11px] font-semibold uppercase tracking-\[0.16em] text-amber-300/90">

&#x20;                       {language === "vi"

&#x20;                         ? `Dang cho duyet (${filteredPendingMembers.length})`

&#x20;                         : `Pending approval (${filteredPendingMembers.length})`}

&#x20;                     </div>



&#x20;                     {filteredPendingMembers.map((item) => {

&#x20;                       const memberId = String(item?.userId ?? "");

&#x20;                       const profile = userProfileMap?.\[memberId];

&#x20;                       const memberName = profile?.fullName ?? `User ${memberId.slice(0, 8)}`;

&#x20;                       const avatarUrl = profile?.avatarUrl ?? null;

&#x20;                       const requestedById = String(item?.requestedByUserId ?? "").trim();

&#x20;                       const requestedByProfile = requestedById ? userProfileMap?.\[requestedById] : null;

&#x20;                       const requestedByName = requestedById

&#x20;                         ? requestedByProfile?.fullName ?? `User ${requestedById.slice(0, 8)}`

&#x20;                         : null;



&#x20;                       return (

&#x20;                         <div key={`pending-${memberId}`} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3">

&#x20;                           <div className="flex items-center gap-3">

&#x20;                             <div className="relative">

&#x20;                               {avatarUrl ? (

&#x20;                                 <img src={avatarUrl} alt={memberName} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />

&#x20;                               ) : (

&#x20;                                 <div className="grid h-11 w-11 place-items-center rounded-full bg-\[#6a4b1c] text-xs font-semibold text-slate-100">

&#x20;                                   {initials(memberName)}

&#x20;                                 </div>

&#x20;                               )}

&#x20;                               <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-400 px-1.5 py-\[2px] text-\[9px] font-bold uppercase text-slate-900">

&#x20;                                 {language === "vi" ? "Cho duyet" : "Pending"}

&#x20;                               </span>

&#x20;                             </div>



&#x20;                             <div className="min-w-0 flex-1">

&#x20;                               <p className="truncate text-\[15px] font-semibold leading-5 text-slate-100">{memberName}</p>

&#x20;                               <p className="truncate pt-0.5 text-xs text-amber-100/90">

&#x20;                                 {language === "vi"

&#x20;                                   ? `${memberName} dang cho truong, pho nhom duyet vao nhom`

&#x20;                                   : `${memberName} is waiting for admin approval to join`}

&#x20;                               </p>

&#x20;                               {requestedByName \&\& (

&#x20;                                 <p className="truncate pt-1 text-\[11px] text-slate-300/90">

&#x20;                                   {language === "vi"

&#x20;                                     ? `Nguoi them: ${requestedByName}`

&#x20;                                     : `Requested by: ${requestedByName}`}

&#x20;                                 </p>

&#x20;                               )}

&#x20;                             </div>

&#x20;                           </div>



&#x20;                           {(isOwner || isAdmin) \&\& (

&#x20;                             <div className="mt-3 flex items-center justify-end gap-2">

&#x20;                               <button

&#x20;                                 type="button"

&#x20;                                 onClick={() => onRejectPendingMember?.(memberId)}

&#x20;                                 className="rounded-lg border border-slate-500/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"

&#x20;                               >

&#x20;                                 {language === "vi" ? "Tu choi" : "Reject"}

&#x20;                               </button>

&#x20;                               <button

&#x20;                                 type="button"

&#x20;                                 onClick={() => onApprovePendingMember?.(memberId)}

&#x20;                                 className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"

&#x20;                               >

&#x20;                                 {language === "vi" ? "Dong y" : "Approve"}

&#x20;                               </button>

&#x20;                             </div>

&#x20;                           )}

&#x20;                         </div>

&#x20;                       );

&#x20;                     })}

&#x20;                   </div>

&#x20;                 )}



&#x20;                 {filteredMembers.map((memberId) => {

&#x20;                   const profile = userProfileMap?.\[memberId];

&#x20;                   const memberName = profile?.fullName ?? `User ${memberId.slice(0, 8)}`;

&#x20;                   const avatarUrl = profile?.avatarUrl ?? null;

&#x20;                   const memberIsOwner = memberId === ownerId;

&#x20;                   const memberIsAdmin = adminIds.includes(memberId);

&#x20;                   const canManageThisMember = memberId !== currentUserId;

&#x20;                   const canRemoveMember = isOwner

&#x20;                     ? !memberIsOwner

&#x20;                     : isAdmin

&#x20;                       ? !memberIsOwner \&\& !memberIsAdmin

&#x20;                       : false;

&#x20;                   const keyColorClass = memberIsOwner

&#x20;                     ? "text-amber-300"

&#x20;                     : memberIsAdmin

&#x20;                       ? "text-slate-300"

&#x20;                       : null;



&#x20;                   return (

&#x20;                     <div key={memberId} className="group relative rounded-2xl border border-\[#2a4b73] bg-\[#0a1f3d] px-3 py-3 shadow-\[inset\_0\_1px\_0\_rgba(255,255,255,0.03)]">

&#x20;                       <div className="flex items-center gap-3">

&#x20;                         <div className="relative">

&#x20;                           {avatarUrl ? (

&#x20;                             <img src={avatarUrl} alt={memberName} className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />

&#x20;                           ) : (

&#x20;                             <div className="grid h-11 w-11 place-items-center rounded-full bg-\[#1d4f83] text-xs font-semibold text-slate-100">

&#x20;                               {initials(memberName)}

&#x20;                             </div>

&#x20;                           )}

&#x20;                           {keyColorClass \&\& (

&#x20;                             <span className={`absolute -bottom-0.5 -right-0.5 grid h-\[18px] w-\[18px] place-items-center rounded-full bg-slate-900 ring-1 ring-\[#335b89] ${keyColorClass}`}>

&#x20;                               <KeyRound size={11} />

&#x20;                             </span>

&#x20;                           )}

&#x20;                         </div>



&#x20;                         <div className="min-w-0 flex-1">

&#x20;                           <p className="truncate text-\[15px] font-semibold leading-5 text-slate-100">{memberName}</p>

&#x20;                           <p className="truncate pt-0.5 text-xs text-slate-400">{renderMemberTag(memberId)}</p>

&#x20;                         </div>



&#x20;                         <div className="flex items-center gap-1.5">

&#x20;                           <button

&#x20;                             type="button"

&#x20;                             onClick={() => onMentionMember?.(memberId)}

&#x20;                             className="grid h-8 w-8 place-items-center rounded-lg border border-amber-300/40 text-\[11px] font-semibold text-amber-200 hover:bg-amber-500/10"

&#x20;                           >

&#x20;                             @

&#x20;                           </button>

&#x20;                           {canManageThisMember \&\& (

&#x20;                             <button

&#x20;                               type="button"

&#x20;                               ref={(node) => {

&#x20;                                 if (node) {

&#x20;                                   memberActionButtonRefs.current\[memberId] = node;

&#x20;                                   return;

&#x20;                                 }

&#x20;                                 delete memberActionButtonRefs.current\[memberId];

&#x20;                               }}

&#x20;                               onClick={(event) => {

&#x20;                                 event.stopPropagation();

&#x20;                                 openMemberActionMenu(memberId);

&#x20;                               }}

&#x20;                               className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-\[#14365f] hover:text-white group-hover:opacity-100"

&#x20;                             >

&#x20;                               <MoreHorizontal size={15} />

&#x20;                             </button>

&#x20;                           )}

&#x20;                         </div>

&#x20;                       </div>



&#x20;                       {canManageThisMember \&\& activeMemberActionId === memberId \&\& (

&#x20;                         <div

&#x20;                           className={`absolute right-3 z-20 min-w-\[11rem] rounded-xl border border-\[#335b89] bg-\[#102d52] p-1.5 shadow-2xl ${activeMemberActionDirection === "up" ? "bottom-\[calc(100%-0.25rem)]" : "top-\[calc(100%-0.25rem)]"}`}

&#x20;                           onClick={(event) => event.stopPropagation()}

&#x20;                         >

&#x20;                           {isOwner \&\& !memberIsOwner \&\& (

&#x20;                             <button

&#x20;                               type="button"

&#x20;                               onClick={() => {

&#x20;                                 onToggleAdmin?.(memberId, !memberIsAdmin);

&#x20;                                 setActiveMemberActionId(null);

&#x20;                               }}

&#x20;                               className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700"

&#x20;                             >

&#x20;                               {memberIsAdmin

&#x20;                                 ? language === "vi"

&#x20;                                   ? "Go quyen pho nhom"

&#x20;                                   : "Remove admin role"

&#x20;                                 : language === "vi"

&#x20;                                   ? "Them quyen pho nhom"

&#x20;                                   : "Grant admin role"}

&#x20;                             </button>

&#x20;                           )}

&#x20;                           {isOwner \&\& !memberIsOwner \&\& (

&#x20;                             <button

&#x20;                               type="button"

&#x20;                               onClick={() => {

&#x20;                                 void onUpdateSettings?.({

&#x20;                                   transferOwnerId: memberId,

&#x20;                                   successMessageVi: "Da chuyen quyen truong nhom",

&#x20;                                   successMessageEn: "Ownership transferred",

&#x20;                                 });

&#x20;                                 setActiveMemberActionId(null);

&#x20;                               }}

&#x20;                               className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-indigo-200 hover:bg-slate-700"

&#x20;                             >

&#x20;                               {language === "vi" ? "Chuyen truong nhom" : "Transfer owner"}

&#x20;                             </button>

&#x20;                           )}

&#x20;                           {canRemoveMember \&\& (

&#x20;                             <button

&#x20;                               type="button"

&#x20;                               onClick={() => {

&#x20;                                 onRemoveMember?.(memberId);

&#x20;                                 setActiveMemberActionId(null);

&#x20;                               }}

&#x20;                               className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/10"

&#x20;                             >

&#x20;                               {language === "vi" ? "Xoa khoi nhom" : "Remove member"}

&#x20;                             </button>

&#x20;                           )}

&#x20;                         </div>

&#x20;                       )}

&#x20;                     </div>

&#x20;                   );

&#x20;                 })}

&#x20;               </div>

&#x20;             </div>

&#x20;           </section>

&#x20;         )}



&#x20;         {!manageMode \&\& panelView === "board" \&\& (

&#x20;           <section className="rounded-2xl border border-slate-700 bg-\[#1a2433] p-3">

&#x20;             <div className="mb-3 flex items-center justify-between gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={backToDefaultPanel}

&#x20;                 className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"

&#x20;               >

&#x20;                 <ArrowLeft size={15} />

&#x20;                 <span>{language === "vi" ? "Quay lai" : "Back"}</span>

&#x20;               </button>

&#x20;               <h3 className="text-base font-semibold text-slate-100">

&#x20;                 {language === "vi" ? "Bang tin nhom" : "Group board"}

&#x20;               </h3>

&#x20;               <button

&#x20;                 type="button"

&#x20;                 disabled={!canCreateNotes}

&#x20;                 onClick={() => setIsCreateNoteOpen(true)}

&#x20;                 className={`grid h-8 w-8 place-items-center rounded-lg ${canCreateNotes ? "bg-sky-600 text-white hover:bg-sky-500" : "bg-slate-700 text-slate-500"}`}

&#x20;               >

&#x20;                 <Plus size={16} />

&#x20;               </button>

&#x20;             </div>



&#x20;             <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-900/45 p-1">

&#x20;               {\[

&#x20;                 { id: "all", labelVi: "Tat ca", labelEn: "All" },

&#x20;                 { id: "pins", labelVi: "Tin ghim", labelEn: "Pins" },

&#x20;                 { id: "notes", labelVi: "Ghi chu", labelEn: "Notes" },

&#x20;                 { id: "polls", labelVi: "Binh chon", labelEn: "Polls" },

&#x20;               ].map((tab) => (

&#x20;                 <button

&#x20;                   key={tab.id}

&#x20;                   type="button"

&#x20;                   onClick={() => setBoardTab(tab.id)}

&#x20;                   className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${boardTab === tab.id ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}

&#x20;                 >

&#x20;                   {language === "vi" ? tab.labelVi : tab.labelEn}

&#x20;                 </button>

&#x20;               ))}

&#x20;             </div>



&#x20;             <div className="max-h-\[44vh] space-y-2 overflow-y-auto pr-1">

&#x20;               {boardItemsForView.length === 0 ? (

&#x20;                 <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">

&#x20;                   {language === "vi" ? "Chua co du lieu trong muc nay" : "No items in this tab yet"}

&#x20;                 </p>

&#x20;               ) : (

&#x20;                 boardItemsForView.map((item) => (

&#x20;                   <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-2">

&#x20;                     <div className="flex items-center justify-between gap-2">

&#x20;                       <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>

&#x20;                       <span className="text-\[11px] text-slate-400">{formatShortDate(item.createdAt)}</span>

&#x20;                     </div>

&#x20;                     {item.preview \&\& <p className="mt-1 text-xs text-slate-300">{item.preview}</p>}

&#x20;                     <div className="mt-2 flex items-center gap-2">

&#x20;                       {item.itemType === "pin" \&\& (

&#x20;                         <>

&#x20;                           <button

&#x20;                             type="button"

&#x20;                             onClick={() => onOpenPinnedMessage?.(item.sourceId)}

&#x20;                             className="rounded-md bg-sky-600 px-2 py-1 text-\[11px] font-semibold text-white hover:bg-sky-500"

&#x20;                           >

&#x20;                             {language === "vi" ? "Xem" : "Open"}

&#x20;                           </button>

&#x20;                           <button

&#x20;                             type="button"

&#x20;                             disabled={!canPinBoardItems}

&#x20;                             onClick={() => {

&#x20;                               if (canPinBoardItems) {

&#x20;                                 onUnpinPinnedMessage?.(item.sourceId);

&#x20;                               }

&#x20;                             }}

&#x20;                             className={`rounded-md border border-rose-400/40 px-2 py-1 text-\[11px] ${canPinBoardItems ? "text-rose-200 hover:bg-rose-500/10" : "text-slate-500"}`}

&#x20;                           >

&#x20;                             {language === "vi" ? "Bo ghim" : "Unpin"}

&#x20;                           </button>

&#x20;                         </>

&#x20;                       )}

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 ))

&#x20;               )}

&#x20;             </div>



&#x20;             <div className="mt-3 grid grid-cols-2 gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => setIsCreateNoteOpen(true)}

&#x20;                 disabled={!canCreateNotes}

&#x20;                 className={`rounded-lg px-3 py-2 text-sm font-semibold ${canCreateNotes ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}

&#x20;               >

&#x20;                 {language === "vi" ? "Tao ghi chu" : "Create note"}

&#x20;               </button>

&#x20;               <button

&#x20;                 type="button"

&#x20;                 disabled={!canCreatePolls}

&#x20;                 onClick={() => setIsCreatePollOpen(true)}

&#x20;                 className={`rounded-lg px-3 py-2 text-sm font-semibold ${canCreatePolls ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}

&#x20;               >

&#x20;                 {language === "vi" ? "Tao binh chon" : "Create poll"}

&#x20;               </button>

&#x20;             </div>

&#x20;           </section>

&#x20;         )}



&#x20;         {!manageMode \&\& panelView === "reminders" \&\& (

&#x20;           <section className="rounded-2xl border border-slate-700 bg-\[#1a2433] p-3">

&#x20;             <div className="mb-3 flex items-center justify-between gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={backToDefaultPanel}

&#x20;                 className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"

&#x20;               >

&#x20;                 <ArrowLeft size={15} />

&#x20;                 <span>{language === "vi" ? "Quay lai" : "Back"}</span>

&#x20;               </button>

&#x20;               <h3 className="text-base font-semibold text-slate-100">

&#x20;                 {language === "vi" ? "Danh sach nhac hen" : "Reminder list"}

&#x20;               </h3>

&#x20;               <button

&#x20;                 type="button"

&#x20;                 disabled={!canCreateReminders}

&#x20;                 onClick={() => setIsCreateReminderOpen(true)}

&#x20;                 className={`grid h-8 w-8 place-items-center rounded-lg ${canCreateReminders ? "bg-sky-600 text-white hover:bg-sky-500" : "bg-slate-700 text-slate-500"}`}

&#x20;               >

&#x20;                 <Plus size={16} />

&#x20;               </button>

&#x20;             </div>

&#x20;             <div className="space-y-2">

&#x20;               {reminderItems.length === 0 ? (

&#x20;                 <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">

&#x20;                   {language === "vi" ? "Chua co nhac hen" : "No reminders yet"}

&#x20;                 </p>

&#x20;               ) : (

&#x20;                 reminderItems.map((item) => (

&#x20;                   <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-3">

&#x20;                     <p className="text-sm font-semibold text-slate-100">{item.title}</p>

&#x20;                     <p className="mt-1 text-xs text-slate-400">

&#x20;                       {item.eventTime ? formatShortDate(item.eventTime) : formatShortDate(item.createdAtMs)}

&#x20;                     </p>

&#x20;                   </div>

&#x20;                 ))

&#x20;               )}

&#x20;             </div>

&#x20;             <button

&#x20;               type="button"

&#x20;               disabled={!canCreateReminders}

&#x20;               onClick={() => setIsCreateReminderOpen(true)}

&#x20;               className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold ${canCreateReminders ? "bg-sky-700 text-white hover:bg-sky-600" : "bg-slate-700 text-slate-500"}`}

&#x20;             >

&#x20;               {language === "vi" ? "Tao nhac hen" : "Create reminder"}

&#x20;             </button>

&#x20;           </section>

&#x20;         )}



&#x20;         {!manageMode \&\& panelView === "archive" \&\& (

&#x20;           <section className="rounded-2xl border border-slate-700 bg-\[#1a2433] p-3">

&#x20;             <div className="mb-3 flex items-center justify-between gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={backToDefaultPanel}

&#x20;                 className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"

&#x20;               >

&#x20;                 <ArrowLeft size={15} />

&#x20;                 <span>{language === "vi" ? "Quay lai" : "Back"}</span>

&#x20;               </button>

&#x20;               <h3 className="text-base font-semibold text-slate-100">

&#x20;                 {language === "vi" ? "Kho luu tru" : "Archive"}

&#x20;               </h3>

&#x20;               <span />

&#x20;             </div>



&#x20;             <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-900/45 p-1">

&#x20;               {\[

&#x20;                 { id: "media", icon: <ImageIcon size={13} />, label: "Anh/Video" },

&#x20;                 { id: "files", icon: <FileText size={13} />, label: "Files" },

&#x20;                 { id: "links", icon: <LinkIcon size={13} />, label: "Links" },

&#x20;               ].map((tab) => (

&#x20;                 <button

&#x20;                   key={tab.id}

&#x20;                   type="button"

&#x20;                   onClick={() => setArchiveTab(tab.id)}

&#x20;                   className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${archiveTab === tab.id ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}

&#x20;                 >

&#x20;                   {tab.icon}

&#x20;                   <span>{tab.label}</span>

&#x20;                 </button>

&#x20;               ))}

&#x20;             </div>



&#x20;             <div className="mb-2 grid grid-cols-2 gap-2">

&#x20;               <select

&#x20;                 value={archiveSenderFilter}

&#x20;                 onChange={(event) => setArchiveSenderFilter(event.target.value)}

&#x20;                 className="h-8 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"

&#x20;               >

&#x20;                 <option value="all">{language === "vi" ? "Nguoi gui" : "Sender"}</option>

&#x20;                 {archiveSenderOptions.map((senderId) => (

&#x20;                   <option key={senderId} value={senderId}>

&#x20;                     {userProfileMap?.\[senderId]?.fullName ?? senderId}

&#x20;                   </option>

&#x20;                 ))}

&#x20;               </select>

&#x20;               <select

&#x20;                 value={archiveDateFilter}

&#x20;                 onChange={(event) => setArchiveDateFilter(event.target.value)}

&#x20;                 className="h-8 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"

&#x20;               >

&#x20;                 <option value="all">{language === "vi" ? "Ngay gui" : "Date"}</option>

&#x20;                 {archiveDateOptions.map((dateKey) => (

&#x20;                   <option key={dateKey} value={dateKey}>

&#x20;                     {dateKey}

&#x20;                   </option>

&#x20;                 ))}

&#x20;               </select>

&#x20;             </div>



&#x20;             <div className="max-h-\[46vh] space-y-2 overflow-y-auto pr-1">

&#x20;               {archiveTab === "media" \&\&

&#x20;                 (archiveMediaItems.length === 0 ? (

&#x20;                   <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">

&#x20;                     {language === "vi" ? "Khong co du lieu" : "No items"}

&#x20;                   </p>

&#x20;                 ) : (

&#x20;                   <div className="grid grid-cols-3 gap-2">

&#x20;                     {archiveMediaItems.map((item) => (

&#x20;                       <a key={item.id} href={item.resolvedFileUrl} target="\_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700">

&#x20;                         {item.type === "VIDEO" ? (

&#x20;                           <div className="grid h-16 place-items-center bg-slate-900 text-slate-300">

&#x20;                             <ImageIcon size={16} />

&#x20;                           </div>

&#x20;                         ) : (

&#x20;                           <img src={item.resolvedFileUrl} alt={item.fileName ?? "media"} className="h-16 w-full object-cover" />

&#x20;                         )}

&#x20;                       </a>

&#x20;                     ))}

&#x20;                   </div>

&#x20;                 ))}



&#x20;               {archiveTab === "files" \&\&

&#x20;                 (archiveFileItems.length === 0 ? (

&#x20;                   <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">

&#x20;                     {language === "vi" ? "Khong co du lieu" : "No items"}

&#x20;                   </p>

&#x20;                 ) : (

&#x20;                   archiveFileItems.map((item) => (

&#x20;                     <a key={item.id} href={item.resolvedFileUrl} target="\_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800">

&#x20;                       <div className="min-w-0">

&#x20;                         <p className="truncate text-sm font-semibold text-slate-100">{item.fileName ?? item.resolvedFileUrl}</p>

&#x20;                         <p className="text-\[11px] text-slate-400">{formatShortDate(item.createdAt)}</p>

&#x20;                       </div>

&#x20;                       <FileText size={15} className="text-slate-300" />

&#x20;                     </a>

&#x20;                   ))

&#x20;                 ))}



&#x20;               {archiveTab === "links" \&\&

&#x20;                 (archiveLinkItems.length === 0 ? (

&#x20;                   <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">

&#x20;                     {language === "vi" ? "Khong co du lieu" : "No items"}

&#x20;                   </p>

&#x20;                 ) : (

&#x20;                   archiveLinkItems.map((item) => (

&#x20;                     <a key={item.id} href={item.link} target="\_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/45 px-2 py-2 hover:bg-slate-800">

&#x20;                       <div className="min-w-0">

&#x20;                         <p className="truncate text-sm font-semibold text-slate-100">{item.link}</p>

&#x20;                         <p className="text-\[11px] text-sky-300">{toDomain(item.link)}</p>

&#x20;                       </div>

&#x20;                       <div className="text-\[11px] text-slate-400">{formatShortDate(item.createdAt)}</div>

&#x20;                     </a>

&#x20;                   ))

&#x20;                 ))}

&#x20;             </div>

&#x20;           </section>

&#x20;         )}



&#x20;         {manageMode \&\& canOpenManage \&\& panelView === "default" \&\& (

&#x20;           <Section

&#x20;             title={language === "vi" ? "Quan ly nhom" : "Group management"}

&#x20;             open={openSections.manage}

&#x20;             onToggle={() => toggleSection("manage")}

&#x20;           >

&#x20;             <div className="space-y-3">

&#x20;               <div className="rounded-xl bg-slate-900/45 p-3">

&#x20;                 <p className="text-sm font-semibold text-slate-100">

&#x20;                   {language === "vi" ? "Cho phep cac thanh vien trong nhom:" : "Allow members to:"}

&#x20;                 </p>

&#x20;                 <div className="mt-2 space-y-2 text-sm text-slate-200">

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Thay doi ten va anh dai dien" : "Edit group name and avatar"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMemberEditGroupInfo}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         void onUpdateSettings?.({ allowMemberEditGroupInfo: event.target.checked });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Ghim tin nhan, ghi chu, binh chon" : "Pin messages, notes, polls"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMemberPinBoardItems}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         void onUpdateSettings?.({ allowMemberPinBoardItems: event.target.checked });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Tao moi ghi chu" : "Create notes"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMemberCreateNotes}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         void onUpdateSettings?.({ allowMemberCreateNotes: event.target.checked });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Tao moi nhac hen" : "Create reminders"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMemberCreateReminders}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         void onUpdateSettings?.({ allowMemberCreateReminders: event.target.checked });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Tao moi binh chon" : "Create polls"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMemberCreatePolls}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         void onUpdateSettings?.({ allowMemberCreatePolls: event.target.checked });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                   <label className="flex items-center justify-between gap-2">

&#x20;                     <span>{language === "vi" ? "Gui tin nhan" : "Send message"}</span>

&#x20;                     <input

&#x20;                       type="checkbox"

&#x20;                       checked={allowMembersSendMessages}

&#x20;                       disabled={!canOpenManage}

&#x20;                       onChange={(event) => {

&#x20;                         const checked = event.target.checked;

&#x20;                         void onUpdateSettings?.({

&#x20;                           allowMembersSendMessages: checked,

&#x20;                           onlyAdminsCanMessage: !checked,

&#x20;                         });

&#x20;                       }}

&#x20;                     />

&#x20;                   </label>

&#x20;                 </div>

&#x20;               </div>



&#x20;               <div className="rounded-xl bg-slate-900/45 p-3 text-sm text-slate-200">

&#x20;                 <div className="flex items-center justify-between gap-2">

&#x20;                   <span>{language === "vi" ? "Che do phe duyet thanh vien moi" : "Require join approval"}</span>

&#x20;                   <input

&#x20;                     type="checkbox"

&#x20;                     checked={Boolean(settings?.requireApprovalToJoin)}

&#x20;                     disabled={!canEditSecuritySettings}

&#x20;                     onChange={(event) => {

&#x20;                       void onUpdateSettings?.({ requireApprovalToJoin: event.target.checked });

&#x20;                     }}

&#x20;                   />

&#x20;                 </div>



&#x20;                 <div className="mt-2 flex items-center justify-between gap-2">

&#x20;                   <span>{language === "vi" ? "Danh dau tin nhan tu truong/pho nhom" : "Highlight owner/admin messages"}</span>

&#x20;                   <input

&#x20;                     type="checkbox"

&#x20;                     checked={Boolean(settings?.highlightAdminMessages)}

&#x20;                     disabled={!canEditSecuritySettings}

&#x20;                     onChange={(event) => {

&#x20;                       void onUpdateSettings?.({ highlightAdminMessages: event.target.checked });

&#x20;                     }}

&#x20;                   />

&#x20;                 </div>



&#x20;                 <div className="mt-2 flex items-center justify-between gap-2">

&#x20;                   <span>{language === "vi" ? "Cho phep dung link tham gia nhom" : "Allow invite by link"}</span>

&#x20;                   <input

&#x20;                     type="checkbox"

&#x20;                     checked={allowMemberInvite}

&#x20;                     disabled={!canEditSecuritySettings}

&#x20;                     onChange={(event) => {

&#x20;                       void onUpdateSettings?.({ allowMemberInvite: event.target.checked });

&#x20;                     }}

&#x20;                   />

&#x20;                 </div>



&#x20;                 <div className="mt-3 rounded-lg bg-\[#0d1d36] px-2 py-2">

&#x20;                   <div className="flex items-center justify-between gap-2">

&#x20;                     {joinLink ? (

&#x20;                       <a

&#x20;                         href={joinLink}

&#x20;                         target="\_blank"

&#x20;                         rel="noreferrer"

&#x20;                         className="block min-w-0 truncate text-sm font-semibold text-sky-200 underline decoration-sky-300/60 underline-offset-2"

&#x20;                       >

&#x20;                         {joinLink}

&#x20;                       </a>

&#x20;                     ) : (

&#x20;                       <p className="truncate text-sm font-semibold text-sky-200">

&#x20;                         {language === "vi" ? "Dang tao link..." : "Generating link..."}

&#x20;                       </p>

&#x20;                     )}

&#x20;                     <div className="flex items-center gap-1">

&#x20;                       <a

&#x20;                         href={joinLink || undefined}

&#x20;                         target="\_blank"

&#x20;                         rel="noreferrer"

&#x20;                         aria-disabled={!joinLink}

&#x20;                         className={`grid h-8 w-8 place-items-center rounded-lg ${joinLink ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "pointer-events-none bg-slate-800/60 text-slate-500"}`}

&#x20;                       >

&#x20;                         <ExternalLink size={14} />

&#x20;                       </a>

&#x20;                       <button

&#x20;                         type="button"

&#x20;                         onClick={copyJoinLink}

&#x20;                         disabled={!joinLink}

&#x20;                         className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"

&#x20;                       >

&#x20;                         <Copy size={14} />

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 </div>



&#x20;                 {!canEditSecuritySettings \&\& (

&#x20;                   <p className="mt-2 text-\[11px] text-amber-300">

&#x20;                     {language === "vi"

&#x20;                       ? "Chi truong nhom hoac pho nhom moi doi duoc cac cai dat bao mat va link moi"

&#x20;                       : "Only the owner or admins can change security and invite-link settings"}

&#x20;                   </p>

&#x20;                 )}

&#x20;               </div>



&#x20;             </div>

&#x20;           </Section>

&#x20;         )}



&#x20;         {panelView === "default" \&\& (

&#x20;           <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">

&#x20;             <div className="flex items-center gap-2 text-rose-200">

&#x20;               <AlertTriangle size={15} />

&#x20;               <p className="text-sm font-semibold">

&#x20;                 {language === "vi" ? "Bao cao va roi nhom" : "Report and leave"}

&#x20;               </p>

&#x20;             </div>

&#x20;             <div className="mt-2 flex gap-2">

&#x20;               <button

&#x20;                 type="button"

&#x20;                 className="flex-1 rounded-lg border border-rose-400/50 px-2 py-2 text-sm font-semibold text-rose-200"

&#x20;               >

&#x20;                 {language === "vi" ? "Bao xau" : "Report"}

&#x20;               </button>

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => onLeaveGroup?.()}

&#x20;                 className="flex-1 rounded-lg border border-rose-400/50 px-2 py-2 text-sm font-semibold text-rose-200"

&#x20;               >

&#x20;                 {language === "vi" ? "Roi nhom" : "Leave"}

&#x20;               </button>

&#x20;             </div>

&#x20;             {isOwner \&\& (

&#x20;               <button

&#x20;                 type="button"

&#x20;                 onClick={() => onDeleteGroup?.()}

&#x20;                 className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"

&#x20;               >

&#x20;                 <Trash2 size={14} />

&#x20;                 <span>{language === "vi" ? "Giai tan nhom" : "Delete group"}</span>

&#x20;               </button>

&#x20;             )}

&#x20;           </section>

&#x20;         )}

&#x20;       </div>

&#x20;     </aside>



&#x20;     {isCreateNoteOpen \&\& (

&#x20;       <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">

&#x20;         <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-\[#111b2a] p-4 shadow-2xl">

&#x20;           <div className="flex items-center justify-between gap-2">

&#x20;             <h3 className="text-lg font-semibold text-slate-100">

&#x20;               {language === "vi" ? "Tao ghi chu nhom" : "Create group note"}

&#x20;             </h3>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 setIsCreateNoteOpen(false);

&#x20;                 setNoteDraft("");

&#x20;                 setIsNotePinnedToTop(true);

&#x20;               }}

&#x20;               className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"

&#x20;             >

&#x20;               {language === "vi" ? "Dong" : "Close"}

&#x20;             </button>

&#x20;           </div>

&#x20;           <textarea

&#x20;             value={noteDraft}

&#x20;             onChange={(event) => setNoteDraft(event.target.value)}

&#x20;             placeholder={language === "vi" ? "Nhap noi dung ghi chu..." : "Enter note content..."}

&#x20;             rows={4}

&#x20;             className="mt-3 w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"

&#x20;           />

&#x20;           <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-200">

&#x20;             <input

&#x20;               type="checkbox"

&#x20;               checked={isNotePinnedToTop}

&#x20;               onChange={(event) => setIsNotePinnedToTop(event.target.checked)}

&#x20;               className="h-4 w-4 accent-lime-500"

&#x20;             />

&#x20;             <span>{language === "vi" ? "Ghim len dau tro chuyen" : "Pin to top of conversation"}</span>

&#x20;           </label>

&#x20;           <div className="mt-4 flex justify-end gap-2">

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 setIsCreateNoteOpen(false);

&#x20;                 setNoteDraft("");

&#x20;                 setIsNotePinnedToTop(true);

&#x20;               }}

&#x20;               className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"

&#x20;             >

&#x20;               {language === "vi" ? "Huy" : "Cancel"}

&#x20;             </button>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 void submitBoardNote();

&#x20;               }}

&#x20;               disabled={!noteDraft.trim()}

&#x20;               className="rounded-md bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;             >

&#x20;               {language === "vi" ? "Tao ghi chu" : "Create note"}

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     )}



&#x20;     {isCreatePollOpen \&\& (

&#x20;       <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">

&#x20;         <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-\[#111b2a] p-4 shadow-2xl">

&#x20;           <div className="flex items-center justify-between gap-2">

&#x20;             <h3 className="text-lg font-semibold text-slate-100">

&#x20;               {language === "vi" ? "Tao binh chon" : "Create poll"}

&#x20;             </h3>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={resetPollDraft}

&#x20;               className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"

&#x20;             >

&#x20;               {language === "vi" ? "Dong" : "Close"}

&#x20;             </button>

&#x20;           </div>

&#x20;           <input

&#x20;             type="text"

&#x20;             value={pollQuestionDraft}

&#x20;             onChange={(event) => setPollQuestionDraft(event.target.value)}

&#x20;             maxLength={200}

&#x20;             placeholder={language === "vi" ? "Nhap cau hoi binh chon" : "Enter poll question"}

&#x20;             className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"

&#x20;           />

&#x20;           <div className="mt-2 space-y-1.5">

&#x20;             {pollOptionDrafts.map((option, index) => (

&#x20;               <div key={`poll-modal-option-${index}`} className="flex items-center gap-2">

&#x20;                 <input

&#x20;                   type="text"

&#x20;                   value={option}

&#x20;                   onChange={(event) => updatePollOption(index, event.target.value)}

&#x20;                   maxLength={80}

&#x20;                   placeholder={language === "vi" ? `Lua chon ${index + 1}` : `Option ${index + 1}`}

&#x20;                   className="h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-xs text-slate-100"

&#x20;                 />

&#x20;                 <button

&#x20;                   type="button"

&#x20;                   disabled={pollOptionDrafts.length <= 2}

&#x20;                   onClick={() => removePollOption(index)}

&#x20;                   className="rounded-md border border-rose-400/40 px-2 py-1 text-\[10px] font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"

&#x20;                 >

&#x20;                   {language === "vi" ? "Xoa" : "Remove"}

&#x20;                 </button>

&#x20;               </div>

&#x20;             ))}

&#x20;           </div>

&#x20;           <div className="mt-2 flex items-center justify-between gap-2">

&#x20;             <button

&#x20;               type="button"

&#x20;               disabled={pollOptionDrafts.length >= 10}

&#x20;               onClick={addPollOption}

&#x20;               className="rounded-md border border-sky-300/40 px-2 py-1 text-\[11px] font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"

&#x20;             >

&#x20;               {language === "vi" ? "Them lua chon" : "Add option"}

&#x20;             </button>

&#x20;             <select

&#x20;               value={pollDeadlineMinutes}

&#x20;               onChange={(event) => setPollDeadlineMinutes(Number(event.target.value))}

&#x20;               className="h-8 rounded-md border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"

&#x20;             >

&#x20;               <option value={30}>{language === "vi" ? "30 phut" : "30 minutes"}</option>

&#x20;               <option value={60}>{language === "vi" ? "1 gio" : "1 hour"}</option>

&#x20;               <option value={180}>{language === "vi" ? "3 gio" : "3 hours"}</option>

&#x20;               <option value={720}>{language === "vi" ? "12 gio" : "12 hours"}</option>

&#x20;               <option value={1440}>{language === "vi" ? "1 ngay" : "1 day"}</option>

&#x20;               <option value={4320}>{language === "vi" ? "3 ngay" : "3 days"}</option>

&#x20;               <option value={10080}>{language === "vi" ? "7 ngay" : "7 days"}</option>

&#x20;             </select>

&#x20;           </div>

&#x20;           <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-200">

&#x20;             <label className="inline-flex items-center gap-2">

&#x20;               <input type="checkbox" checked={isPollMultiChoice} onChange={(event) => setIsPollMultiChoice(event.target.checked)} className="h-4 w-4 accent-sky-500" />

&#x20;               <span>{language === "vi" ? "Cho phep chon nhieu dap an" : "Allow multiple choices"}</span>

&#x20;             </label>

&#x20;             <label className="inline-flex items-center gap-2">

&#x20;               <input type="checkbox" checked={isPollAllowChangeVote} onChange={(event) => setIsPollAllowChangeVote(event.target.checked)} className="h-4 w-4 accent-sky-500" />

&#x20;               <span>{language === "vi" ? "Cho phep doi lua chon" : "Allow changing vote"}</span>

&#x20;             </label>

&#x20;             <label className="inline-flex items-center gap-2">

&#x20;               <input type="checkbox" checked={isPollHideResultsBeforeVote} onChange={(event) => setIsPollHideResultsBeforeVote(event.target.checked)} className="h-4 w-4 accent-sky-500" />

&#x20;               <span>{language === "vi" ? "An ket qua truoc khi bo phieu" : "Hide results before voting"}</span>

&#x20;             </label>

&#x20;           </div>

&#x20;           <div className="mt-4 flex justify-end gap-2">

&#x20;             <button type="button" onClick={resetPollDraft} className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">

&#x20;               {language === "vi" ? "Huy" : "Cancel"}

&#x20;             </button>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 void submitCreatePoll();

&#x20;               }}

&#x20;               disabled={!pollQuestionDraft.trim()}

&#x20;               className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;             >

&#x20;               {language === "vi" ? "Tao binh chon" : "Create poll"}

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     )}



&#x20;     {isCreateReminderOpen \&\& (

&#x20;       <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">

&#x20;         <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-\[#111b2a] p-4 shadow-2xl">

&#x20;           <div className="flex items-center justify-between gap-2">

&#x20;             <h3 className="text-lg font-semibold text-slate-100">

&#x20;               {language === "vi" ? "Tao nhac hen" : "Create reminder"}

&#x20;             </h3>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 setIsCreateReminderOpen(false);

&#x20;                 setReminderTitleDraft("");

&#x20;                 setReminderTimeDraft("");

&#x20;               }}

&#x20;               className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"

&#x20;             >

&#x20;               {language === "vi" ? "Dong" : "Close"}

&#x20;             </button>

&#x20;           </div>

&#x20;           <input

&#x20;             type="text"

&#x20;             value={reminderTitleDraft}

&#x20;             onChange={(event) => setReminderTitleDraft(event.target.value)}

&#x20;             placeholder={language === "vi" ? "Tieu de nhac hen" : "Reminder title"}

&#x20;             className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"

&#x20;           />

&#x20;           <label className="mt-2 block text-xs text-slate-300">

&#x20;             <span className="mb-1 inline-block">{language === "vi" ? "Thoi gian (tuy chon)" : "Time (optional)"}</span>

&#x20;             <input

&#x20;               type="datetime-local"

&#x20;               value={reminderTimeDraft}

&#x20;               onChange={(event) => setReminderTimeDraft(event.target.value)}

&#x20;               className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"

&#x20;             />

&#x20;           </label>

&#x20;           <div className="mt-4 flex justify-end gap-2">

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 setIsCreateReminderOpen(false);

&#x20;                 setReminderTitleDraft("");

&#x20;                 setReminderTimeDraft("");

&#x20;               }}

&#x20;               className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"

&#x20;             >

&#x20;               {language === "vi" ? "Huy" : "Cancel"}

&#x20;             </button>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 void submitCreateReminder();

&#x20;               }}

&#x20;               disabled={!reminderTitleDraft.trim()}

&#x20;               className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;             >

&#x20;               {language === "vi" ? "Tao" : "Create"}

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     )}



&#x20;     {isMemberPickerOpen \&\& (

&#x20;       <div className="fixed inset-0 z-90 grid place-items-center bg-slate-900/70 p-4">

&#x20;         <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-\[#111b2a] p-4 shadow-2xl">

&#x20;           <div className="flex items-start justify-between gap-3">

&#x20;             <div>

&#x20;               <h3 className="text-lg font-semibold text-slate-100">

&#x20;                 {language === "vi" ? "Them thanh vien" : "Add members"}

&#x20;               </h3>

&#x20;               <p className="mt-1 text-xs text-slate-400">

&#x20;                 {language === "vi"

&#x20;                   ? "Chon mot hoac nhieu ban be de them vao nhom"

&#x20;                   : "Select one or multiple friends to add into this group"}

&#x20;               </p>

&#x20;             </div>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={closeMemberPicker}

&#x20;               disabled={isAddingMembers}

&#x20;               className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;             >

&#x20;               {language === "vi" ? "Dong" : "Close"}

&#x20;             </button>

&#x20;           </div>



&#x20;           <input

&#x20;             type="text"

&#x20;             value={memberPickerSearch}

&#x20;             onChange={(event) => setMemberPickerSearch(event.target.value)}

&#x20;             placeholder={language === "vi" ? "Tim theo ten, email, userId" : "Search by name, email, userId"}

&#x20;             className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500"

&#x20;           />



&#x20;           <div className="mt-3 max-h-\[48vh] space-y-2 overflow-y-auto pr-1">

&#x20;             {addableFriendCandidates.length === 0 ? (

&#x20;               <div className="rounded-lg border border-slate-700 bg-slate-900/45 px-3 py-4 text-sm text-slate-300">

&#x20;                 {language === "vi"

&#x20;                   ? "Khong co ban be phu hop de them vao nhom"

&#x20;                   : "No matching friends available to add"}

&#x20;               </div>

&#x20;             ) : (

&#x20;               addableFriendCandidates.map((candidate) => {

&#x20;                 const selected = selectedMemberIds.includes(candidate.userId);

&#x20;                 return (

&#x20;                   <button

&#x20;                     key={candidate.userId}

&#x20;                     type="button"

&#x20;                     onClick={() => toggleCandidate(candidate.userId)}

&#x20;                     className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-900/35 hover:bg-slate-800"}`}

&#x20;                   >

&#x20;                     {candidate.avatarUrl ? (

&#x20;                       <img

&#x20;                         src={candidate.avatarUrl}

&#x20;                         alt={candidate.displayName}

&#x20;                         className="h-10 w-10 rounded-full object-cover"

&#x20;                       />

&#x20;                     ) : (

&#x20;                       <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">

&#x20;                         {initials(candidate.displayName)}

&#x20;                       </div>

&#x20;                     )}



&#x20;                     <div className="min-w-0 flex-1">

&#x20;                       <p className="truncate text-sm font-semibold text-slate-100">

&#x20;                         {candidate.displayName}

&#x20;                       </p>

&#x20;                       <p className="truncate text-xs text-slate-400">

&#x20;                         {candidate.email || candidate.userId}

&#x20;                       </p>

&#x20;                     </div>



&#x20;                     <span

&#x20;                       className={`h-4 w-4 rounded-full border ${selected ? "border-sky-400 bg-sky-400" : "border-slate-500"}`}

&#x20;                     />

&#x20;                   </button>

&#x20;                 );

&#x20;               })

&#x20;             )}

&#x20;           </div>



&#x20;           <div className="mt-4 flex items-center justify-between gap-3">

&#x20;             <p className="text-xs text-slate-300">

&#x20;               {language === "vi"

&#x20;                 ? `Da chon ${selectedMemberIds.length} nguoi`

&#x20;                 : `${selectedMemberIds.length} selected`}

&#x20;             </p>

&#x20;             <button

&#x20;               type="button"

&#x20;               onClick={() => {

&#x20;                 void submitAddMembers();

&#x20;               }}

&#x20;               disabled={isAddingMembers || selectedMemberIds.length === 0}

&#x20;               className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

&#x20;             >

&#x20;               {isAddingMembers

&#x20;                 ? language === "vi"

&#x20;                   ? "Dang them..."

&#x20;                   : "Adding..."

&#x20;                 : language === "vi"

&#x20;                   ? "Them thanh vien"

&#x20;                   : "Add members"}

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     )}

&#x20;   </div>

&#x20; );

}



