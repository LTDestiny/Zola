function initials(name) {
  const parts = (name || "").split(" ").filter(Boolean);
  if (parts.length === 0) return "G";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function GroupChat({
  language,
  conversation,
  members,
  userProfileMap,
  children,
}) {
  const safeMembers = members ?? [];

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">{children}</div>

      <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === "vi" ? "Thong tin nhom" : "Group Details"}
          </p>
          <div className="mt-3 flex items-center gap-3">
            {conversation?.avatar ? (
              <img
                src={conversation.avatar}
                alt={conversation.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {initials(conversation?.name ?? "Group")}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {conversation?.name ?? (language === "vi" ? "Nhom" : "Group")}
              </p>
              <p className="text-xs text-slate-500">
                {safeMembers.length} {language === "vi" ? "thanh vien" : "members"}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            {language === "vi" ? "Danh sach thanh vien" : "Member List"}
          </p>
          <div className="space-y-1.5">
            {safeMembers.map((memberId) => {
              const profile = userProfileMap?.[memberId];
              const name = profile?.fullName ?? `User ${memberId.slice(0, 8)}`;
              const avatar = profile?.avatarUrl ?? null;
              return (
                <div
                  key={memberId}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                      {initials(name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{name}</p>
                    <p className="truncate text-[11px] text-slate-500">{memberId}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
