import { useMemo, useState } from "react";

function initials(name) {
  const parts = (name || "").split(" ").filter(Boolean);
  if (parts.length === 0) return "G";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function CreateGroupModal({
  open,
  language,
  contacts,
  userProfileMap,
  isSubmitting,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const selectableContacts = useMemo(() => {
    return (contacts ?? []).map((contact) => {
      const profile = userProfileMap?.[contact.userId];
      const displayName = profile?.fullName ?? `User ${contact.userId.slice(0, 8)}`;
      const email = profile?.email ?? contact.userId;
      return {
        userId: contact.userId,
        displayName,
        email,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    });
  }, [contacts, userProfileMap]);

  if (!open) {
    return null;
  }

  const toggleUser = (userId) => {
    setSelectedIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }
      return [...current, userId];
    });
  };

  const handleClose = () => {
    setName("");
    setSelectedIds([]);
    onClose?.();
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || selectedIds.length === 0) {
      return;
    }
    await onCreate?.({ name: trimmedName, memberIds: selectedIds });
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-xl font-semibold text-slate-900">
          {language === "vi" ? "Tao nhom" : "Create Group"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {language === "vi"
            ? "Dat ten nhom va chon thanh vien de bat dau"
            : "Name the group and choose members to start chatting"}
        </p>

        <label className="mt-4 block text-xs font-semibold text-slate-500">
          {language === "vi" ? "Ten nhom" : "Group name"}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={language === "vi" ? "Nhap ten nhom" : "Enter group name"}
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          />
        </label>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            {language === "vi" ? "Thanh vien" : "Members"}
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {selectableContacts.length === 0 && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                {language === "vi"
                  ? "Chua co ban be de tao nhom"
                  : "No contacts available for group creation"}
              </div>
            )}

            {selectableContacts.map((contact) => {
              const selected = selectedIds.includes(contact.userId);
              return (
                <button
                  key={contact.userId}
                  type="button"
                  onClick={() => toggleUser(contact.userId)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.displayName} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {initials(contact.displayName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{contact.displayName}</p>
                    <p className="truncate text-xs text-slate-500">{contact.email}</p>
                  </div>
                  <span className={`h-4 w-4 rounded-full border ${selected ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-lg border border-slate-300 px-4 text-sm text-slate-700"
          >
            {language === "vi" ? "Dong" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCreate();
            }}
            disabled={isSubmitting || !name.trim() || selectedIds.length === 0}
            className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting
              ? language === "vi"
                ? "Dang tao..."
                : "Creating..."
              : language === "vi"
                ? "Tao nhom"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
