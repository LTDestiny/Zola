import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Newspaper,
  Pin,
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
    <section className="rounded-2xl border border-slate-700 bg-[#1a2433]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <span className="text-[27px] font-semibold text-slate-100">{title}</span>
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
  userProfileMap,
  messages,
  currentUserId,
  settings,
  preferences,
  onRefreshSettings,
  onUpdateSettings,
  onAddMember,
  onRemoveMember,
  onToggleAdmin,
  onMentionMember,
  onLeaveGroup,
  onDeleteGroup,
  onPreferenceChange,
  onSendTemplateMessage,
  children,
}) {
  const safeMembers = members ?? [];
  const safeMessages = messages ?? [];

  const [nameDraft, setNameDraft] = useState(conversation?.name ?? "");
  const [avatarDraft, setAvatarDraft] = useState(conversation?.avatar ?? "");
  const [memberIdDraft, setMemberIdDraft] = useState("");
  const [searchText, setSearchText] = useState("");
  const [manageMode, setManageMode] = useState(false);
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
    renameGroup: true,
    pinBoardItems: true,
    createReminder: true,
    createPoll: true,
    sendMessage: true,
  });

  useEffect(() => {
    setNameDraft(conversation?.name ?? "");
    setAvatarDraft(conversation?.avatar ?? "");
    setManageMode(false);
  }, [conversation?.id, conversation?.name, conversation?.avatar]);

  const ownerId = settings?.ownerId ?? conversation?.ownerId ?? null;
  const adminIds = settings?.admins ?? conversation?.admins ?? [];
  const isOwner = Boolean(
    settings?.isOwner ?? (currentUserId && ownerId && currentUserId === ownerId),
  );
  const isAdmin = Boolean(
    settings?.isAdmin ?? (currentUserId && adminIds.includes(currentUserId)),
  );
  const canOpenManage = isOwner || isAdmin;
  const canInviteMembers = canOpenManage || Boolean(settings?.allowMemberInvite);
  const canEditSecuritySettings = isOwner;

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

  const mediaItems = useMemo(() => {
    return parsedMessages
      .filter((item) => {
        if (!item.resolvedFileUrl) return false;
        if (item.type === "IMAGE" || item.type === "VIDEO" || item.type === "GIF") {
          return true;
        }
        const fileName = String(item.fileName ?? "").toLowerCase();
        return /(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);
      })
      .slice(0, 8);
  }, [parsedMessages]);

  const fileItems = useMemo(() => {
    return parsedMessages
      .filter((item) => {
        if (!item.resolvedFileUrl) return false;
        if (item.type === "FILE") return true;
        const fileName = String(item.fileName ?? "").toLowerCase();
        return !/(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|mkv|avif)$/.test(fileName);
      })
      .slice(0, 6);
  }, [parsedMessages]);

  const linkItems = useMemo(() => {
    const bucket = [];
    parsedMessages.forEach((item) => {
      item.links.forEach((link) => {
        bucket.push({
          id: `${item.id}-${link}`,
          link,
          createdAt: item.createdAt,
        });
      });
    });
    return bucket.slice(0, 6);
  }, [parsedMessages]);

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

  const saveGroupInfo = async () => {
    await onUpdateSettings?.({
      name: nameDraft.trim(),
      avatar: avatarDraft.trim() ? avatarDraft.trim() : null,
    });
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
    "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] transition";

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex flex-1 flex-col overflow-hidden">{children}</div>

      <aside
        className={`hidden w-[380px] shrink-0 border-l border-slate-700 bg-[#111b2a] lg:flex lg:flex-col ${isPanelOpen ? "" : "lg:hidden"}`}
      >
        <div className="border-b border-slate-700 px-4 py-4">
          <p className="text-center text-3xl font-bold text-slate-100">
            {language === "vi" ? "Thong tin nhom" : "Group details"}
          </p>

          <div className="mt-4 flex flex-col items-center">
            {conversation?.avatar ? (
              <img
                src={conversation.avatar}
                alt={conversation?.name ?? "Group"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-500/25 text-lg font-bold text-sky-100">
                {initials(conversation?.name ?? "Group")}
              </div>
            )}
            <p className="mt-3 text-center text-4xl font-semibold text-slate-100">
              {conversation?.name ?? (language === "vi" ? "Nhom" : "Group")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {language === "vi" ? "Cong dong" : "Community"}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onPreferenceChange?.({ muted: !Boolean(preferences?.muted) })}
              className={`${iconActionBase} ${preferences?.muted ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">
                <BellOff size={14} />
              </span>
              <span>{language === "vi" ? "Bat thong bao" : "Notify"}</span>
            </button>

            <button
              type="button"
              onClick={() => onPreferenceChange?.({ pinned: !Boolean(preferences?.pinned) })}
              className={`${iconActionBase} ${preferences?.pinned ? "bg-sky-500/20 text-sky-100" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">
                <Pin size={14} />
              </span>
              <span>{language === "vi" ? "Ghim hoi thoai" : "Pin"}</span>
            </button>

            <button
              type="button"
              disabled={!canInviteMembers}
              onClick={() => {
                const targetUserId = window.prompt(
                  language === "vi"
                    ? "Nhap userId thanh vien can them"
                    : "Enter member userId",
                );
                if (targetUserId && targetUserId.trim()) {
                  onAddMember?.(targetUserId.trim());
                }
              }}
              className={`${iconActionBase} ${canInviteMembers ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">
                <UserPlus size={14} />
              </span>
              <span>{language === "vi" ? "Them thanh vien" : "Add member"}</span>
            </button>

            <button
              type="button"
              disabled={!canOpenManage}
              onClick={() => setManageMode((prev) => !prev)}
              className={`${iconActionBase} ${canOpenManage ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-800/60 text-slate-500"}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700/80">
                <Settings size={14} />
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {!manageMode && (
            <>
              <Section
                title={language === "vi" ? "Thanh vien nhom" : "Members"}
                open={openSections.members}
                onToggle={() => toggleSection("members")}
              >
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-300" />
                    <span>
                      {safeMembers.length} {language === "vi" ? "thanh vien" : "members"}
                    </span>
                  </div>

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
                  <button
                    type="button"
                    onClick={() => onSendTemplateMessage?.("REMINDER")}
                    className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <Newspaper size={16} className="text-slate-300" />
                    <span>{language === "vi" ? "Danh sach nhac hen" : "Reminder list"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendTemplateMessage?.("NOTE")}
                    className="flex w-full items-center gap-2 rounded-xl bg-slate-900/45 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <FileText size={16} className="text-slate-300" />
                    <span>{language === "vi" ? "Ghi chu, ghim, binh chon" : "Notes, pins, polls"}</span>
                  </button>
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
                    {mediaItems.map((item) => (
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
                    {fileItems.slice(0, 3).map((item) => (
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
                    {linkItems.slice(0, 3).map((item) => (
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

          {manageMode && canOpenManage && (
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
                        onChange={(event) =>
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            renameGroup: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Ghim tin nhan, ghi chu, binh chon" : "Pin messages, notes, polls"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.pinBoardItems}
                        onChange={(event) =>
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            pinBoardItems: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Tao moi ghi chu, nhac hen" : "Create notes and reminders"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.createReminder}
                        onChange={(event) =>
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            createReminder: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Tao moi binh chon" : "Create polls"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.createPoll}
                        onChange={(event) =>
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            createPoll: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>{language === "vi" ? "Gui tin nhan" : "Send message"}</span>
                      <input
                        type="checkbox"
                        checked={memberPermissionMap.sendMessage}
                        onChange={(event) =>
                          setMemberPermissionMap((prev) => ({
                            ...prev,
                            sendMessage: event.target.checked,
                          }))
                        }
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
                    <span>{language === "vi" ? "Danh dau tin nhan tu truong/pho nhom" : "Only owner/admin can send"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.onlyAdminsCanMessage)}
                      disabled={!canEditSecuritySettings}
                      onChange={(event) => {
                        void onUpdateSettings?.({ onlyAdminsCanMessage: event.target.checked });
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span>{language === "vi" ? "Cho phep dung link tham gia nhom" : "Allow invite by link"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings?.allowMemberInvite ?? true)}
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
                        ? "Chi truong nhom moi doi duoc cac cai dat bao mat va link moi"
                        : "Only the owner can change security and invite-link settings"}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-900/45 p-3">
                  <p className="text-sm font-semibold text-slate-100">
                    {language === "vi" ? "Thong tin nhom" : "Group profile"}
                  </p>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      placeholder={language === "vi" ? "Ten nhom" : "Group name"}
                      className="h-9 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm text-slate-100"
                    />
                    <input
                      type="text"
                      value={avatarDraft}
                      onChange={(event) => setAvatarDraft(event.target.value)}
                      placeholder="Avatar URL"
                      className="h-9 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveGroupInfo();
                      }}
                      className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      {language === "vi" ? "Luu thong tin" : "Save group profile"}
                    </button>
                  </div>
                </div>

                <Section
                  title={language === "vi" ? `Danh sach thanh vien (${safeMembers.length})` : `Members (${safeMembers.length})`}
                  open={openSections.memberList}
                  onToggle={() => toggleSection("memberList")}
                >
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder={language === "vi" ? "Tim kiem thanh vien" : "Search members"}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => onRefreshSettings?.()}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        <Settings size={14} />
                      </button>
                    </div>

                    {canInviteMembers && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={memberIdDraft}
                          onChange={(event) => setMemberIdDraft(event.target.value)}
                          placeholder={language === "vi" ? "Nhap userId de them" : "Enter userId to add"}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextUserId = memberIdDraft.trim();
                            if (!nextUserId) {
                              return;
                            }
                            onAddMember?.(nextUserId);
                            setMemberIdDraft("");
                          }}
                          className="rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-500"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
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

                        return (
                          <div key={memberId} className="rounded-lg border border-slate-700 bg-slate-900/35 px-2 py-2">
                            <div className="flex items-center gap-2">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={memberName} className="h-9 w-9 rounded-full object-cover" />
                              ) : (
                                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
                                  {initials(memberName)}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-100">{memberName}</p>
                                <p className="truncate text-xs text-slate-400">{renderMemberTag(memberId)}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => onMentionMember?.(memberId)}
                                className="rounded-md border border-amber-300/40 px-2 py-1 text-[11px] font-semibold text-amber-200"
                              >
                                @
                              </button>
                            </div>

                            {canManageThisMember && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {isOwner && !memberIsOwner && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleAdmin?.(memberId, !memberIsAdmin)}
                                    className="rounded-md border border-slate-500 px-2 py-1 text-[11px] text-slate-200"
                                  >
                                    {memberIsAdmin
                                      ? language === "vi"
                                        ? "Xoa pho nhom"
                                        : "Remove admin"
                                      : language === "vi"
                                        ? "Them pho nhom"
                                        : "Make admin"}
                                  </button>
                                )}

                                {isOwner && !memberIsOwner && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void onUpdateSettings?.({ transferOwnerId: memberId });
                                    }}
                                    className="rounded-md border border-indigo-400/40 px-2 py-1 text-[11px] text-indigo-200"
                                  >
                                    {language === "vi" ? "Chuyen truong nhom" : "Transfer owner"}
                                  </button>
                                )}

                                {canRemoveMember && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveMember?.(memberId)}
                                    className="rounded-md border border-rose-400/40 px-2 py-1 text-[11px] text-rose-200"
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
                </Section>
              </div>
            </Section>
          )}

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
        </div>
      </aside>
    </div>
  );
}
