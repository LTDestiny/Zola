import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Shield,
  Ban,
  Plus,
  AlertTriangle,
  BellOff,
} from "lucide-react";
import { resolveMediaUrl } from "../utils/mediaUrl";

function initials(name) {
  const parts = (name || "").split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
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

export function DirectChat({
  language,
  conversation,
  isPanelOpen = true,
  userProfileMap,
  messages,
  currentUserId,
  onBlockPeer,
  isBlockedByMe,
  pinnedMessages,
  onOpenPinnedMessage,
  onUnpinPinnedMessage,
  onCreateBoardNote,
  onCreateReminder,
  preferences,
  onPreferenceChange,
  onClosePanel,
  children,
}) {
  const safeMessages = messages ?? [];
  const safePinnedMessages = pinnedMessages ?? [];

  const [panelView, setPanelView] = useState("default");
  const [boardTab, setBoardTab] = useState("all");
  const [archiveTab, setArchiveTab] = useState("media");
  const [archiveSenderFilter, setArchiveSenderFilter] = useState("all");
  const [archiveDateFilter, setArchiveDateFilter] = useState("all");

  const [openSections, setOpenSections] = useState({
    board: true,
    media: true,
    files: true,
    links: true,
    security: true,
  });

  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isNotePinnedToTop, setIsNotePinnedToTop] = useState(true);

  const [isCreateReminderOpen, setIsCreateReminderOpen] = useState(false);
  const [reminderTitleDraft, setReminderTitleDraft] = useState("");
  const [reminderTimeDraft, setReminderTimeDraft] = useState("");

  const peerId = conversation?.participants?.find((p) => p && p !== currentUserId) ?? null;
  const peerProfile = userProfileMap?.[peerId ?? ""];
  const displayName = peerProfile?.fullName ?? conversation?.name ?? `User ${peerId?.slice(0, 8) ?? ""}`;
  const resolvedAvatar = resolveMediaUrl(peerProfile?.avatarUrl ?? conversation?.avatar ?? null);

  useEffect(() => {
    setPanelView("default");
    setBoardTab("all");
    setArchiveTab("media");
    setArchiveSenderFilter("all");
    setArchiveDateFilter("all");
    setIsCreateNoteOpen(false);
    setIsCreateReminderOpen(false);
  }, [conversation?.id]);

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

  const mediaItems = useMemo(() => {
    return parsedMessages.filter((item) => {
      if (!item.resolvedFileUrl) return false;
      if (item.type === "IMAGE" || item.type === "VIDEO" || item.type === "GIF") return true;
      const fileName = String(item.fileName ?? "").toLowerCase();
      return /(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);
    });
  }, [parsedMessages]);

  const fileItems = useMemo(() => {
    return parsedMessages.filter((item) => {
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
          title: title || (language === "vi" ? "Nhắc hẹn" : "Reminder"),
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
        title: String(item.json?.title ?? (language === "vi" ? "Ghi chú" : "Note")),
        preview: String(item.json?.note ?? item.json?.preview ?? item.content ?? ""),
        itemType: "note",
        senderId: item.senderId ?? null,
      }));

    return [...pinnedItems, ...noteItems].sort((left, right) => right.createdAtMs - left.createdAtMs);
  }, [safePinnedMessages, parsedMessages, language]);

  const boardItemsForView = useMemo(() => {
    if (boardTab === "all") return boardFeedItems;
    if (boardTab === "pins") return boardFeedItems.filter((item) => item.itemType === "pin");
    if (boardTab === "notes") return boardFeedItems.filter((item) => item.itemType === "note");
    return boardFeedItems;
  }, [boardFeedItems, boardTab]);

  const archiveSenderOptions = useMemo(() => {
    const senderIds = new Set();
    [...mediaItems, ...fileItems, ...linkItems].forEach((item) => {
      if (item.senderId) senderIds.add(item.senderId);
    });
    return Array.from(senderIds);
  }, [mediaItems, fileItems, linkItems]);

  const archiveDateOptions = useMemo(() => {
    const dateKeys = new Set();
    [...mediaItems, ...fileItems, ...linkItems].forEach((item) => {
      const sourceDate = item.createdAt ? new Date(item.createdAt) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) return;
      const key = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
      dateKeys.add(key);
    });
    return Array.from(dateKeys).sort((left, right) => (left < right ? 1 : -1));
  }, [mediaItems, fileItems, linkItems]);

  const applyArchiveFilters = (items) => {
    return items.filter((item) => {
      const senderOk = archiveSenderFilter === "all" || item.senderId === archiveSenderFilter;
      if (!senderOk) return false;

      if (archiveDateFilter === "all") return true;

      const sourceDate = item.createdAt ? new Date(item.createdAt) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) return false;

      const itemKey = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
      return itemKey === archiveDateFilter;
    });
  };

  const archiveMediaItems = useMemo(() => applyArchiveFilters(mediaItems), [mediaItems, archiveSenderFilter, archiveDateFilter]);
  const archiveFileItems = useMemo(() => applyArchiveFilters(fileItems), [fileItems, archiveSenderFilter, archiveDateFilter]);
  const archiveLinkItems = useMemo(() => applyArchiveFilters(linkItems), [linkItems, archiveSenderFilter, archiveDateFilter]);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openArchiveView = (tab) => {
    setArchiveTab(tab);
    setPanelView("archive");
  };
  const backToDefaultPanel = () => setPanelView("default");

  const submitBoardNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    await onCreateBoardNote?.(trimmed, isNotePinnedToTop);
    setNoteDraft("");
    setIsNotePinnedToTop(true);
    setIsCreateNoteOpen(false);
  };

  const submitReminder = async () => {
    const titleTrimmed = reminderTitleDraft.trim();
    if (!titleTrimmed) return;
    let finalTime = reminderTimeDraft.trim() || null;
    if (finalTime && !finalTime.includes("T")) {
      finalTime = new Date(finalTime).toISOString();
    }
    await onCreateReminder?.({ title: titleTrimmed, when: finalTime });
    setReminderTitleDraft("");
    setReminderTimeDraft("");
    setIsCreateReminderOpen(false);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex flex-1 flex-col overflow-hidden">{children}</div>

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[24rem] shrink-0 flex-col border-l border-[#1f4673] bg-[#0d2442] pt-[var(--zola-mobile-top-safe-area)] lg:pt-0 transform transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:w-[24rem] lg:shrink-0 lg:transform-none lg:transition-none ${isPanelOpen ? "translate-x-0" : "translate-x-full"} ${isPanelOpen ? "flex lg:flex" : "hidden lg:hidden"}`}
      >
        <div className="shrink-0 border-b border-[#1f4673] px-3 py-3 lg:px-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-slate-100 lg:text-2xl lg:text-center">
              {language === "vi" ? "Thông tin hội thoại" : "Chat details"}
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
            <div className="group relative rounded-full cursor-default">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={displayName}
                  className="h-16 w-16 rounded-full border-2 border-slate-500/70 object-cover object-center shadow-lg lg:h-20 lg:w-20"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-500/25 text-lg font-bold text-sky-100 lg:h-20 lg:w-20 lg:text-xl">
                  {initials(displayName)}
                </div>
              )}
            </div>
            <h1 className="mt-2 text-center text-xl font-bold text-slate-100 lg:text-2xl">
              {displayName}
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 lg:px-4 space-y-4">
          {panelView === "default" && (
            <>
              {boardFeedItems.length > 0 && (
                <Section
                  title={language === "vi" ? "Bảng tin" : "Board"}
                  open={openSections.board}
                  onToggle={() => toggleSection("board")}
                >
                  <div className="space-y-2">
                    {boardFeedItems.slice(0, 2).map((item) => (
                      <div key={item.id} className="rounded-lg bg-slate-900/45 p-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                        <div className="mt-1 flex items-center gap-2">
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
                                onClick={() => onUnpinPinnedMessage?.(item.sourceId)}
                                className="rounded-md border border-rose-400/40 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10"
                              >
                                {language === "vi" ? "Bỏ ghim" : "Unpin"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanelView("board")}
                    className="mt-3 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tất cả" : "View all"}
                  </button>
                </Section>
              )}

              <Section
                title={language === "vi" ? "Ảnh/Video" : "Media"}
                open={openSections.media}
                onToggle={() => toggleSection("media")}
              >
                {previewMediaItems.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {previewMediaItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-square overflow-hidden rounded-lg bg-slate-900"
                      >
                        {item.type === "VIDEO" ? (
                          <video src={item.resolvedFileUrl} className="h-full w-full object-cover opacity-80" />
                        ) : (
                          <img src={item.resolvedFileUrl} alt="Media" className="h-full w-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chưa có ảnh/video" : "No media"}
                  </p>
                )}
                {mediaItems.length > 8 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("media")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tất cả" : "View all"}
                  </button>
                )}
              </Section>

              <Section
                title={language === "vi" ? "Tài liệu" : "Files"}
                open={openSections.files}
                onToggle={() => toggleSection("files")}
              >
                {previewFileItems.length > 0 ? (
                  <div className="space-y-2">
                    {previewFileItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2 hover:bg-slate-700/50"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-400">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">{item.fileName || "File"}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chưa có tài liệu" : "No files"}
                  </p>
                )}
                {fileItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("files")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tất cả" : "View all"}
                  </button>
                )}
              </Section>

              <Section
                title={language === "vi" ? "Link" : "Links"}
                open={openSections.links}
                onToggle={() => toggleSection("links")}
              >
                {previewLinkItems.length > 0 ? (
                  <div className="space-y-2">
                    {previewLinkItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2 hover:bg-slate-700/50"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-400">
                          <LinkIcon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">{toDomain(item.link)}</p>
                          <p className="truncate text-xs text-slate-400">{item.link}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chưa có link" : "No links"}
                  </p>
                )}
                {linkItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("links")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tất cả" : "View all"}
                  </button>
                )}
              </Section>

              <Section
                title={language === "vi" ? "Thiết lập bảo mật" : "Security settings"}
                open={openSections.security}
                onToggle={() => toggleSection("security")}
              >
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <BellOff size={15} className="text-slate-300" />
                      <span>{language === "vi" ? "Tắt thông báo" : "Mute notifications"}</span>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={Boolean(preferences?.muted)}
                        onChange={(event) => onPreferenceChange?.({ muted: event.target.checked })}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Shield size={15} className="text-slate-300" />
                      <span>{language === "vi" ? "Tin nhắn tự xóa" : "Self-destruct"}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {language === "vi" ? "Không bao giờ" : "Never"}
                    </span>
                  </div>

                  <label className="flex items-center justify-between rounded-lg bg-slate-900/45 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-slate-300" />
                      <span>{language === "vi" ? "Ẩn trò chuyện" : "Hide conversation"}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences?.hidden)}
                      onChange={(event) => onPreferenceChange?.({ hidden: event.target.checked })}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={onBlockPeer}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl bg-slate-900/45 px-3 py-2 text-left text-sm font-semibold text-rose-400 hover:bg-rose-500/10"
                  >
                    <Ban size={18} />
                    <span>
                      {isBlockedByMe
                        ? language === "vi"
                          ? "Bỏ chặn người này"
                          : "Unblock this user"
                        : language === "vi"
                          ? "Chặn người này"
                          : "Block this user"}
                    </span>
                  </button>
                </div>
              </Section>
            </>
          )}

          {panelView === "archive" && (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
                >
                  <ArrowLeft size={18} />
                </button>
                <p className="text-sm font-semibold text-slate-200">
                  {language === "vi" ? "Lưu trữ" : "Archive"}
                </p>
              </div>

              <div className="flex gap-2 border-b border-[#2a4b73] px-1">
                <button
                  type="button"
                  onClick={() => setArchiveTab("media")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${archiveTab === "media" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  {language === "vi" ? "Ảnh/Video" : "Media"}
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab("files")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${archiveTab === "files" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  {language === "vi" ? "Tài liệu" : "Files"}
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab("links")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${archiveTab === "links" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  {language === "vi" ? "Link" : "Links"}
                </button>
              </div>

              <div className="mt-4 flex-1 space-y-4">
                {archiveTab === "media" && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {archiveMediaItems.map((item) => (
                      <a key={item.id} href={item.resolvedFileUrl} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-lg bg-slate-900">
                        {item.type === "VIDEO" ? (
                          <video src={item.resolvedFileUrl} className="h-full w-full object-cover opacity-80" />
                        ) : (
                          <img src={item.resolvedFileUrl} alt="Media" className="h-full w-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
                {archiveTab === "files" && (
                  <div className="space-y-2">
                    {archiveFileItems.map((item) => (
                      <a key={item.id} href={item.resolvedFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-[#2a4b73] bg-[#0f294a] p-3 hover:bg-[#15365f]">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-400">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">{item.fileName || "File"}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {archiveTab === "links" && (
                  <div className="space-y-2">
                    {archiveLinkItems.map((item) => (
                      <a key={item.id} href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-[#2a4b73] bg-[#0f294a] p-3 hover:bg-[#15365f]">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-400">
                          <LinkIcon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">{toDomain(item.link)}</p>
                          <p className="truncate text-xs text-slate-400">{item.link}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {panelView === "board" && (
            <section className="rounded-2xl border border-slate-700 bg-[#1a2433] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lại" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? "Bảng tin" : "Board"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateNoteOpen(true)}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-900/45 p-1">
                {[
                  { id: "all", labelVi: "Tất cả", labelEn: "All" },
                  { id: "pins", labelVi: "Tin ghim", labelEn: "Pins" },
                  { id: "notes", labelVi: "Ghi chú", labelEn: "Notes" },
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
                    {language === "vi" ? "Chưa có dữ liệu trong mục này" : "No items in this tab yet"}
                  </p>
                ) : (
                  boardItemsForView.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                        <span className="text-[11px] text-slate-400">{formatShortDate(item.createdAtMs)}</span>
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
                              onClick={() => onUnpinPinnedMessage?.(item.sourceId)}
                              className="rounded-md border border-rose-400/40 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10"
                            >
                              {language === "vi" ? "Bỏ ghim" : "Unpin"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {isCreateNoteOpen && (
                <div className="mt-4 rounded-xl border border-slate-600 bg-slate-800 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-100">
                    {language === "vi" ? "Tạo ghi chú mới" : "Create new note"}
                  </p>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={language === "vi" ? "Nhập nội dung ghi chú..." : "Enter note content..."}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 text-sm text-slate-100"
                  />
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={isNotePinnedToTop}
                      onChange={(e) => setIsNotePinnedToTop(e.target.checked)}
                      className="h-4 w-4 accent-lime-500"
                    />
                    <span>
                      {language === "vi"
                        ? "Ghim lên đầu trò chuyện"
                        : "Pin to top of conversation"}
                    </span>
                  </label>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateNoteOpen(false)}
                      className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {language === "vi" ? "Hủy" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={submitBoardNote}
                      disabled={!noteDraft.trim()}
                      className="rounded-md bg-lime-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {language === "vi" ? "Tạo ghi chú" : "Create note"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {panelView === "reminders" && (
            <section className="rounded-2xl border border-slate-700 bg-[#1a2433] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToDefaultPanel}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft size={15} />
                  <span>{language === "vi" ? "Quay lại" : "Back"}</span>
                </button>
                <h3 className="text-base font-semibold text-slate-100">
                  {language === "vi" ? "Danh sách nhắc hẹn" : "Reminder list"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateReminderOpen(true)}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {reminderItems.length === 0 ? (
                  <p className="rounded-lg bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
                    {language === "vi" ? "Chưa có nhắc hẹn" : "No reminders yet"}
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
              {isCreateReminderOpen && (
                <div className="mt-4 rounded-xl border border-slate-600 bg-slate-800 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-100">
                    {language === "vi" ? "Tạo nhắc hẹn mới" : "Create new reminder"}
                  </p>
                  <input
                    type="text"
                    value={reminderTitleDraft}
                    onChange={(e) => setReminderTitleDraft(e.target.value)}
                    placeholder={language === "vi" ? "Tiêu đề nhắc hẹn..." : "Reminder title..."}
                    className="mb-2 h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100"
                  />
                  <input
                    type="datetime-local"
                    value={reminderTimeDraft}
                    onChange={(e) => setReminderTimeDraft(e.target.value)}
                    className="mb-2 h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateReminderOpen(false)}
                      className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {language === "vi" ? "Hủy" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={submitReminder}
                      disabled={!reminderTitleDraft.trim()}
                      className="rounded-md bg-lime-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {language === "vi" ? "Tạo nhắc hẹn" : "Create reminder"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>
      </aside>
    </div>
  );
}
