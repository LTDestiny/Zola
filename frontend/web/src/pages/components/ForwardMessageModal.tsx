import { useMemo, useState } from "react";
import type { ConversationItem, UserProfile } from "../../api/chatApi";

type ForwardMessageModalProps = {
  open: boolean;
  language: "vi" | "en";
  conversations: ConversationItem[];
  activeConversationId: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSearchUserByEmail: (email: string) => Promise<UserProfile | null>;
  onConfirm: (payload: { targetConversationIds: string[]; targetUserIds: string[] }) => Promise<void>;
};

type ForwardTab = "all" | "friends" | "groups";

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function isGroupConversation(item: ConversationItem) {
  return (item.participants?.length ?? 0) > 2;
}

export function ForwardMessageModal({
  open,
  language,
  conversations,
  activeConversationId,
  isSubmitting,
  onClose,
  onSearchUserByEmail,
  onConfirm,
}: ForwardMessageModalProps) {
  const [activeTab, setActiveTab] = useState<ForwardTab>("all");
  const [keyword, setKeyword] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  const targets = useMemo(() => {
    const base = conversations.filter((item) => item.id !== activeConversationId);

    const byTab = base.filter((item) => {
      if (activeTab === "friends") return !isGroupConversation(item);
      if (activeTab === "groups") return isGroupConversation(item);
      return true;
    });

    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return byTab;
    }

    return byTab.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.lastMessage.toLowerCase().includes(normalized)
      );
    });
  }, [activeConversationId, activeTab, conversations, keyword]);

  if (!open) return null;

  const toggleSelection = (conversationId: string) => {
    setSelectedConversationIds((prev) => {
      if (prev.includes(conversationId)) {
        return prev.filter((id) => id !== conversationId);
      }
      return [...prev, conversationId];
    });
  };

  const onAddUserByEmail = async () => {
    const email = searchEmail.trim();
    if (!email || isSearchingUser) {
      return;
    }

    try {
      setIsSearchingUser(true);
      const user = await onSearchUserByEmail(email);
      if (!user) {
        return;
      }

      setSelectedUsers((prev) => {
        if (prev.some((item) => item.id === user.id)) {
          return prev;
        }
        return [...prev, user];
      });
      setSearchEmail("");
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleConfirm = async () => {
    if ((selectedConversationIds.length === 0 && selectedUsers.length === 0) || isSubmitting) {
      return;
    }
    await onConfirm({
      targetConversationIds: selectedConversationIds,
      targetUserIds: selectedUsers.map((item) => item.id),
    });
    setSelectedConversationIds([]);
    setSelectedUsers([]);
    setKeyword("");
    setSearchEmail("");
    setActiveTab("all");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          {language === "vi" ? "Chuyen tiep tin nhan" : "Forward message"}
        </h3>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-2 text-sm ${activeTab === "all" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"}`}
          >
            {language === "vi" ? "Tat ca" : "All"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("friends")}
            className={`rounded-lg px-3 py-2 text-sm ${activeTab === "friends" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"}`}
          >
            {language === "vi" ? "Ban be" : "Friends"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className={`rounded-lg px-3 py-2 text-sm ${activeTab === "groups" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"}`}
          >
            {language === "vi" ? "Nhom" : "Groups"}
          </button>
        </div>

        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={language === "vi" ? "Tim ban be hoac nhom..." : "Search friends or groups..."}
          className="mt-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
        />

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {targets.map((item) => {
            const selected = selectedConversationIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSelection(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${selected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {initials(item.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {isGroupConversation(item)
                      ? (language === "vi" ? "Nhom" : "Group")
                      : (language === "vi" ? "Ban be" : "Friend")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  className="h-4 w-4 accent-indigo-600"
                />
              </button>
            );
          })}

          {targets.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
              {language === "vi" ? "Khong tim thay doi tuong de chuyen tiep" : "No available target to forward"}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            {language === "vi" ? "Them nguoi nhan bang email" : "Add recipient by email"}
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="seed3@example.com"
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
            />
            <button
              type="button"
              disabled={!searchEmail.trim() || isSearchingUser}
              onClick={() => {
                void onAddUserByEmail();
              }}
              className="rounded-lg border border-indigo-300 px-3 text-sm text-indigo-700 disabled:opacity-50"
            >
              {isSearchingUser
                ? (language === "vi" ? "Dang tim" : "Searching")
                : (language === "vi" ? "Them" : "Add")}
            </button>
          </div>

          {selectedUsers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUsers((prev) => prev.filter((item) => item.id !== user.id));
                  }}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                >
                  {user.fullName || user.email || user.id} x
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {language === "vi"
              ? `Da chon ${selectedConversationIds.length + selectedUsers.length} doi tuong`
              : `${selectedConversationIds.length + selectedUsers.length} target(s) selected`}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedConversationIds([]);
                setSelectedUsers([]);
                setKeyword("");
                setSearchEmail("");
                setActiveTab("all");
                onClose();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              {language === "vi" ? "Huy" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={(selectedConversationIds.length === 0 && selectedUsers.length === 0) || isSubmitting}
              onClick={() => {
                void handleConfirm();
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting
                ? (language === "vi" ? "Dang chuyen..." : "Forwarding...")
                : (language === "vi" ? "Chuyen tiep" : "Forward")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
