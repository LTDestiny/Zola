import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Image as ImageIcon, FileText, Link as LinkIcon, Shield, Ban } from "lucide-react";
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
  onClosePanel,
  children,
}) {
  const safeMessages = messages ?? [];

  const [panelView, setPanelView] = useState("default");
  const [archiveTab, setArchiveTab] = useState("media");
  const [archiveSenderFilter, setArchiveSenderFilter] = useState("all");
  const [archiveDateFilter, setArchiveDateFilter] = useState("all");

  const [openSections, setOpenSections] = useState({
    media: true,
    files: true,
    links: true,
    security: true,
  });

  const peerId = conversation?.participants?.find((p) => p && p !== currentUserId) ?? null;
  const peerProfile = userProfileMap?.[peerId ?? ""];
  const displayName = peerProfile?.fullName ?? conversation?.name ?? `User ${peerId?.slice(0, 8) ?? ""}`;
  const resolvedAvatar = resolveMediaUrl(peerProfile?.avatarUrl ?? conversation?.avatar ?? null);

  useEffect(() => {
    setPanelView("default");
    setArchiveTab("media");
    setArchiveSenderFilter("all");
    setArchiveDateFilter("all");
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
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openArchiveView = (tab) => {
    setArchiveTab(tab);
    setPanelView("archive");
  };
  const backToDefaultPanel = () => setPanelView("default");

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex flex-1 flex-col overflow-hidden">{children}</div>

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[24rem] shrink-0 flex-col border-l border-[#1f4673] bg-[#0d2442] pt-[var(--zola-mobile-top-safe-area)] lg:pt-0 transform transition-transform duration-300 lg:relative lg:inset-auto lg:z-auto lg:w-[24rem] lg:shrink-0 lg:transform-none lg:transition-none ${isPanelOpen ? "translate-x-0" : "translate-x-full"} ${isPanelOpen ? "flex lg:flex" : "hidden lg:hidden"}`}
      >
        <div className="shrink-0 border-b border-[#1f4673] px-3 py-3 lg:px-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-slate-100 lg:text-2xl lg:text-center">
              {language === "vi" ? "Thong tin hoi thoai" : "Chat details"}
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
              <Section
                title={language === "vi" ? "Bao mat" : "Security"}
                open={openSections.security}
                onToggle={() => toggleSection("security")}
              >
                <button
                  type="button"
                  onClick={onBlockPeer}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-400 hover:bg-rose-500/10"
                >
                  <Ban size={18} />
                  <span>
                    {isBlockedByMe
                      ? language === "vi"
                        ? "Bo chan nguoi nay"
                        : "Unblock this user"
                      : language === "vi"
                        ? "Chan nguoi nay"
                        : "Block this user"}
                  </span>
                </button>
              </Section>

              <Section
                title={language === "vi" ? "Anh/Video" : "Media"}
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
                          <video
                            src={item.resolvedFileUrl}
                            className="h-full w-full object-cover opacity-80"
                          />
                        ) : (
                          <img
                            src={item.resolvedFileUrl}
                            alt="Media"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chua co anh/video" : "No media"}
                  </p>
                )}
                {mediaItems.length > 8 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("media")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tat ca" : "View all"}
                  </button>
                )}
              </Section>

              <Section
                title={language === "vi" ? "Tai lieu" : "Files"}
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
                          <p className="truncate text-sm font-semibold text-slate-200">
                            {item.fileName || "File"}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chua co tai lieu" : "No files"}
                  </p>
                )}
                {fileItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("files")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tat ca" : "View all"}
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
                          <p className="truncate text-sm font-semibold text-slate-200">
                            {toDomain(item.link)}
                          </p>
                          <p className="truncate text-xs text-slate-400">{item.link}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    {language === "vi" ? "Chua co link" : "No links"}
                  </p>
                )}
                {linkItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openArchiveView("links")}
                    className="mt-3 block w-full rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    {language === "vi" ? "Xem tat ca" : "View all"}
                  </button>
                )}
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
                  {language === "vi" ? "Luu tru" : "Archive"}
                </p>
              </div>

              <div className="flex gap-2 border-b border-[#2a4b73] px-1">
                <button
                  type="button"
                  onClick={() => setArchiveTab("media")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${
                    archiveTab === "media"
                      ? "border-sky-400 text-sky-300"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {language === "vi" ? "Anh/Video" : "Media"}
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab("files")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${
                    archiveTab === "files"
                      ? "border-sky-400 text-sky-300"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {language === "vi" ? "Tai lieu" : "Files"}
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab("links")}
                  className={`border-b-2 px-3 py-2 text-sm font-semibold ${
                    archiveTab === "links"
                      ? "border-sky-400 text-sky-300"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {language === "vi" ? "Link" : "Links"}
                </button>
              </div>

              <div className="mt-4 flex-1 space-y-4">
                {archiveTab === "media" && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {archiveMediaItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-square overflow-hidden rounded-lg bg-slate-900"
                      >
                        {item.type === "VIDEO" ? (
                          <video
                            src={item.resolvedFileUrl}
                            className="h-full w-full object-cover opacity-80"
                          />
                        ) : (
                          <img
                            src={item.resolvedFileUrl}
                            alt="Media"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                )}
                {archiveTab === "files" && (
                  <div className="space-y-2">
                    {archiveFileItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.resolvedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-[#2a4b73] bg-[#0f294a] p-3 hover:bg-[#15365f]"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-400">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">
                            {item.fileName || "File"}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {archiveTab === "links" && (
                  <div className="space-y-2">
                    {archiveLinkItems.map((item) => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-[#2a4b73] bg-[#0f294a] p-3 hover:bg-[#15365f]"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-400">
                          <LinkIcon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-200">
                            {toDomain(item.link)}
                          </p>
                          <p className="truncate text-xs text-slate-400">{item.link}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
