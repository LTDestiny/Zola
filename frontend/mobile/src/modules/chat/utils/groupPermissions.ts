import type { ConversationItem, GroupSettings } from "@/shared/types/api";

function normalizeId(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeIds(values: string[] | null | undefined) {
  return (values ?? []).map((value) => normalizeId(value)).filter(Boolean);
}

export function resolveGroupSettingsRoleFlags(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const normalizedCurrentUserId = normalizeId(currentUserId);
  const ownerId = normalizeId(settings?.ownerId ?? conversation?.ownerId);
  const adminIds = normalizeIds(settings?.admins ?? conversation?.admins);

  const isOwner = Boolean(
    normalizedCurrentUserId &&
    ownerId &&
    normalizedCurrentUserId === ownerId,
  );
  const isAdmin = Boolean(
    normalizedCurrentUserId &&
    adminIds.includes(normalizedCurrentUserId),
  );

  if (!settings) {
    return {
      conversationId: normalizeId(conversation?.id),
      name: conversation?.name ?? "",
      avatar: conversation?.avatar ?? null,
      ownerId: ownerId || null,
      admins: adminIds,
      participants: conversation?.participants ?? [],
      allowMembersEditGroupProfile: false,
      allowMembersPinBoardItems: false,
      allowMembersCreateNotes: false,
      allowMembersCreatePolls: false,
      allowMembersSendMessages: false,
      onlyAdminsCanMessage: true,
      requireApprovalToJoin: false,
      highlightAdminMessages: false,
      allowMemberInvite: false,
      inviteCode: null,
      isOwner,
      isAdmin,
    } satisfies GroupSettings;
  }

  return {
    ...settings,
    ownerId: ownerId || null,
    admins: adminIds,
    participants: settings.participants ?? conversation?.participants ?? [],
    isOwner: Boolean(settings.isOwner || isOwner),
    isAdmin: Boolean(settings.isAdmin || isAdmin),
  };
}

export function canCurrentUserManageMemberPermissions(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const resolved = resolveGroupSettingsRoleFlags(settings, currentUserId, conversation);
  return Boolean(resolved.isOwner || resolved.isAdmin);
}

export function canCurrentUserEditSecuritySettings(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const resolved = resolveGroupSettingsRoleFlags(settings, currentUserId, conversation);
  return Boolean(resolved.isOwner);
}

export function canCurrentUserEditGroupProfile(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const resolved = resolveGroupSettingsRoleFlags(settings, currentUserId, conversation);
  return Boolean(
    resolved.isOwner ||
    resolved.isAdmin ||
    resolved.allowMembersEditGroupProfile,
  );
}

export function canCurrentUserInviteMembers(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const resolved = resolveGroupSettingsRoleFlags(settings, currentUserId, conversation);
  return Boolean(
    resolved.isOwner ||
    resolved.isAdmin ||
    resolved.allowMemberInvite,
  );
}

export function canCurrentUserSendGroupMessages(
  settings: GroupSettings | null | undefined,
  currentUserId: string | null | undefined,
  conversation?: ConversationItem | null,
) {
  const resolved = resolveGroupSettingsRoleFlags(settings, currentUserId, conversation);
  return Boolean(
    resolved.isOwner ||
    resolved.isAdmin ||
    resolved.allowMembersSendMessages,
  );
}
