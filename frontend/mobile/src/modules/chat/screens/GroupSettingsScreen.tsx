import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  deleteGroupConversation,
  getGroupSettings,
  leaveGroupConversation,
  removeGroupMember,
  setGroupAdmin,
  toApiErrorMessage,
  updateGroupSettings,
} from "@/modules/chat/api/chatApi";
import { AddGroupMemberModal } from "@/modules/chat/components/AddGroupMemberModal";
import {
  canCurrentUserEditGroupProfile,
  canCurrentUserEditSecuritySettings,
  canCurrentUserInviteMembers,
  canCurrentUserManageMemberPermissions,
  resolveGroupSettingsRoleFlags,
} from "@/modules/chat/utils/groupPermissions";
import { fetchUserProfile } from "@/modules/chat/utils/conversationUtils";
import { useAuthStore } from "@/modules/auth/authStore";
import { useChatStore } from "@/modules/chat/store/chatStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { GroupSettings, UpdateGroupSettingsInput } from "@/shared/types/api";
import { borderRadius, colors, spacing, typography } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "GroupSettings">;

type PermissionKey =
  | "allowMembersEditGroupProfile"
  | "allowMembersPinBoardItems"
  | "allowMembersCreateNotes"
  | "allowMembersCreatePolls"
  | "allowMembersSendMessages";

type SecurityKey =
  | "requireApprovalToJoin"
  | "highlightAdminMessages"
  | "allowMemberInvite";

type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (nextValue: boolean) => void;
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SwitchRow({
  label,
  description,
  value,
  disabled,
  onValueChange,
}: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchRowText}>
        <Text style={[styles.rowLabel, disabled && styles.disabledText]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, disabled && styles.disabledText]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : "#FFFFFF"}
      />
    </View>
  );
}

export function GroupSettingsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const routeConversation = route.params.conversation;
  const conversations = useChatStore((s) => s.conversations);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const me = useAuthStore((s) => s.me);

  const conversation = useMemo(
    () =>
      conversations.find((item) => item.id === routeConversation.id) ??
      routeConversation,
    [conversations, routeConversation],
  );

  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [participantNameMap, setParticipantNameMap] = useState<Record<string, string>>({});

  const resolvedSettings = useMemo(
    () => resolveGroupSettingsRoleFlags(settings, me?.id ?? null, conversation),
    [conversation, me?.id, settings],
  );

  const isOwner = resolvedSettings.isOwner;
  const isAdmin = resolvedSettings.isAdmin;
  const canManageMemberPermissions = canCurrentUserManageMemberPermissions(
    resolvedSettings,
    me?.id ?? null,
    conversation,
  );
  const canEditSecuritySettings = canCurrentUserEditSecuritySettings(
    resolvedSettings,
    me?.id ?? null,
    conversation,
  );
  const canEditGroupProfile = canCurrentUserEditGroupProfile(
    resolvedSettings,
    me?.id ?? null,
    conversation,
  );
  const canInviteMembers = canCurrentUserInviteMembers(
    resolvedSettings,
    me?.id ?? null,
    conversation,
  );

  const syncConversationSnapshot = useCallback((nextSettings: GroupSettings) => {
    upsertConversation({
      id: conversation.id,
      name: nextSettings.name,
      avatar: nextSettings.avatar,
      ownerId: nextSettings.ownerId,
      admins: nextSettings.admins,
      participants: nextSettings.participants,
    });
  }, [conversation.id, upsertConversation]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGroupSettings(conversation.id);
      setSettings(response.data);
      setEditName(response.data.name ?? "");
      syncConversationSnapshot(response.data);
    } catch (error) {
      Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the tai cai dat nhom");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, syncConversationSnapshot]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
      return () => undefined;
    }, [loadSettings]),
  );

  useEffect(() => {
    const participantIds = conversation.participants ?? [];
    let cancelled = false;

    void Promise.all(
      participantIds.map(async (userId) => {
        if (userId === me?.id) {
          return [userId, me.fullName ?? "Ban"] as const;
        }

        const profile = await fetchUserProfile(userId);
        return [userId, profile?.fullName ?? `User ${userId.slice(0, 8)}`] as const;
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setParticipantNameMap(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [conversation.participants, me]);

  const updateSettingsWithFeedback = useCallback(async (
    payload: UpdateGroupSettingsInput,
    successMessage: string,
    pendingValue: string,
  ) => {
    setSavingKey(pendingValue);
    try {
      const response = await updateGroupSettings(conversation.id, payload);
      setSettings(response.data);
      setEditName(response.data.name ?? "");
      syncConversationSnapshot(response.data);
      Alert.alert("Thong bao", successMessage);
      return true;
    } catch (error) {
      Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the cap nhat cai dat nhom");
      return false;
    } finally {
      setSavingKey(null);
    }
  }, [conversation.id, syncConversationSnapshot]);

  const handleUpdateName = useCallback(async () => {
    if (!canEditGroupProfile) {
      Alert.alert("Thong bao", "Ban khong co quyen sua ten hoac anh nhom");
      return;
    }

    if (!editName.trim()) {
      Alert.alert("Thong bao", "Ten nhom khong duoc de trong");
      return;
    }

    const didUpdate = await updateSettingsWithFeedback(
      { name: editName.trim() },
      "Da cap nhat ten nhom",
      "name",
    );

    if (didUpdate) {
      setShowEditNameModal(false);
    }
  }, [canEditGroupProfile, editName, updateSettingsWithFeedback]);

  const handlePermissionToggle = useCallback(async (
    key: PermissionKey,
    nextValue: boolean,
  ) => {
    if (!canManageMemberPermissions) {
      Alert.alert("Thong bao", "Chi truong nhom hoac pho nhom moi duoc sua quyen thanh vien");
      return;
    }

    const labelMap: Record<PermissionKey, string> = {
      allowMembersEditGroupProfile: "Da cap nhat quyen doi ten va anh dai dien",
      allowMembersPinBoardItems: "Da cap nhat quyen ghim tin nhan va bang tin",
      allowMembersCreateNotes: "Da cap nhat quyen tao ghi chu va nhac hen",
      allowMembersCreatePolls: "Da cap nhat quyen tao binh chon",
      allowMembersSendMessages: "Da cap nhat quyen gui tin nhan",
    };

    await updateSettingsWithFeedback(
      { [key]: nextValue },
      labelMap[key],
      key,
    );
  }, [canManageMemberPermissions, updateSettingsWithFeedback]);

  const handleSecurityToggle = useCallback(async (
    key: SecurityKey,
    nextValue: boolean,
  ) => {
    if (!canEditSecuritySettings) {
      Alert.alert("Thong bao", "Chi truong nhom moi duoc sua cai dat bao mat");
      return;
    }

    const labelMap: Record<SecurityKey, string> = {
      requireApprovalToJoin: "Da cap nhat che do phe duyet thanh vien moi",
      highlightAdminMessages: "Da cap nhat danh dau tin nhan admin",
      allowMemberInvite: "Da cap nhat quyen tham gia bang ma moi",
    };

    await updateSettingsWithFeedback(
      { [key]: nextValue },
      labelMap[key],
      key,
    );
  }, [canEditSecuritySettings, updateSettingsWithFeedback]);

  const handleRemoveMember = useCallback((userId: string) => {
    if (!canManageMemberPermissions) {
      Alert.alert("Thong bao", "Chi truong nhom hoac pho nhom moi duoc xoa thanh vien");
      return;
    }

    Alert.alert(
      "Xac nhan",
      "Ban co chac muon xoa thanh vien nay khoi nhom?",
      [
        { text: "Huy", style: "cancel" },
        {
          text: "Xoa",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroupMember(conversation.id, userId);
              Alert.alert("Thong bao", "Da xoa thanh vien");
              await loadSettings();
            } catch (error) {
              Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the xoa thanh vien");
            }
          },
        },
      ],
    );
  }, [canManageMemberPermissions, conversation.id, loadSettings]);

  const handleToggleAdmin = useCallback((userId: string, nextValue: boolean) => {
    if (!isOwner) {
      Alert.alert("Thong bao", "Chi truong nhom moi duoc thay doi pho nhom");
      return;
    }

    setSavingKey(`admin-${userId}`);
    void setGroupAdmin(conversation.id, userId, nextValue)
      .then(async () => {
        Alert.alert("Thong bao", nextValue ? "Da cap quyen pho nhom" : "Da go quyen pho nhom");
        await loadSettings();
      })
      .catch((error) => {
        Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the cap nhat vai tro admin");
      })
      .finally(() => {
        setSavingKey(null);
      });
  }, [conversation.id, isOwner, loadSettings]);

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      "Xac nhan",
      "Ban chac chan muon roi khoi nhom?",
      [
        { text: "Huy", style: "cancel" },
        {
          text: "Roi nhom",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroupConversation(conversation.id);
              navigation.navigate("ChatList");
            } catch (error) {
              Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the roi nhom");
            }
          },
        },
      ],
    );
  }, [conversation.id, navigation]);

  const handleDeleteGroup = useCallback(() => {
    if (!isOwner) {
      Alert.alert("Thong bao", "Chi truong nhom moi duoc xoa nhom");
      return;
    }

    Alert.alert(
      "Xac nhan",
      "Ban chac chan muon xoa nhom? Hanh dong nay khong the hoan tac.",
      [
        { text: "Huy", style: "cancel" },
        {
          text: "Xoa nhom",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroupConversation(conversation.id);
              navigation.navigate("ChatList");
            } catch (error) {
              Alert.alert("Thong bao", toApiErrorMessage(error) || "Khong the xoa nhom");
            }
          },
        },
      ],
    );
  }, [conversation.id, isOwner, navigation]);

  const permissionItems: Array<{
    key: PermissionKey;
    label: string;
    description: string;
    value: boolean;
  }> = [
    {
      key: "allowMembersEditGroupProfile",
      label: "Thay doi ten va anh dai dien",
      description: "Thanh vien co the sua ten nhom va anh dai dien.",
      value: Boolean(resolvedSettings.allowMembersEditGroupProfile),
    },
    {
      key: "allowMembersPinBoardItems",
      label: "Ghim tin nhan, ghi chu, binh chon",
      description: "Thanh vien co the thao tac voi bang tin nhom.",
      value: Boolean(resolvedSettings.allowMembersPinBoardItems),
    },
    {
      key: "allowMembersCreateNotes",
      label: "Tao moi ghi chu, nhac hen",
      description: "Dong bo voi quyen tao ghi chu va reminder tren web.",
      value: Boolean(resolvedSettings.allowMembersCreateNotes),
    },
    {
      key: "allowMembersCreatePolls",
      label: "Tao moi binh chon",
      description: "Thanh vien co the tao poll trong nhom.",
      value: Boolean(resolvedSettings.allowMembersCreatePolls),
    },
    {
      key: "allowMembersSendMessages",
      label: "Gui tin nhan",
      description: "Tat quyen nay se an composer doi voi thanh vien thuong.",
      value: Boolean(resolvedSettings.allowMembersSendMessages),
    },
  ];

  const securityItems: Array<{
    key: SecurityKey;
    label: string;
    description: string;
    value: boolean;
  }> = [
    {
      key: "requireApprovalToJoin",
      label: "Phe duyet thanh vien moi",
      description: "Nguoi moi vao nhom can duoc chap thuan.",
      value: Boolean(resolvedSettings.requireApprovalToJoin),
    },
    {
      key: "highlightAdminMessages",
      label: "Danh dau tin nhan truong/pho nhom",
      description: "Dong bo voi che do highlight tren web.",
      value: Boolean(resolvedSettings.highlightAdminMessages),
    },
    {
      key: "allowMemberInvite",
      label: "Cho phep tham gia bang ma moi",
      description: "Cho phep su dung invite code cua nhom.",
      value: Boolean(resolvedSettings.allowMemberInvite),
    },
  ];

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Dang tai cai dat nhom...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <SectionCard title="Thong tin nhom">
          <Pressable
            style={styles.infoRow}
            disabled={!canEditGroupProfile}
            onPress={() => setShowEditNameModal(true)}
          >
            <View>
              <Text style={styles.rowLabel}>Ten nhom</Text>
              <Text style={styles.rowValue}>{resolvedSettings.name || conversation.name || "Group"}</Text>
            </View>
            <Text style={[styles.rowAction, !canEditGroupProfile && styles.disabledText]}>
              {canEditGroupProfile ? "Sua" : "Chi doc"}
            </Text>
          </Pressable>

          <View style={styles.infoRow}>
            <View>
              <Text style={styles.rowLabel}>Thanh vien</Text>
              <Text style={styles.rowValue}>{resolvedSettings.participants.length}</Text>
            </View>
            <View style={styles.roleBadgeRow}>
              <View style={[styles.roleBadge, isOwner ? styles.ownerBadge : styles.adminBadge]}>
                <Text style={styles.roleBadgeText}>
                  {isOwner ? "Truong nhom" : isAdmin ? "Pho nhom" : "Thanh vien"}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Quyen thanh vien">
          {permissionItems.map((item) => (
            <SwitchRow
              key={item.key}
              label={item.label}
              description={item.description}
              value={item.value}
              disabled={!canManageMemberPermissions || savingKey === item.key}
              onValueChange={(nextValue) => {
                void handlePermissionToggle(item.key, nextValue);
              }}
            />
          ))}

          {!canManageMemberPermissions ? (
            <Text style={styles.helperText}>
              Chi truong nhom hoac pho nhom moi duoc sua quyen thanh vien.
            </Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Bao mat va loi moi">
          {securityItems.map((item) => (
            <SwitchRow
              key={item.key}
              label={item.label}
              description={item.description}
              value={item.value}
              disabled={!canEditSecuritySettings || savingKey === item.key}
              onValueChange={(nextValue) => {
                void handleSecurityToggle(item.key, nextValue);
              }}
            />
          ))}

          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>Ma moi nhom</Text>
            <Text style={styles.inviteCode}>{resolvedSettings.inviteCode || "Dang tao..."}</Text>
            <Text style={styles.inviteHint}>
              Mobile hien dang dung invite code nay de tham gia nhom.
            </Text>
          </View>

          {!canEditSecuritySettings ? (
            <Text style={styles.helperText}>
              Chi truong nhom moi duoc sua bao mat, nhan tin admin va ma moi.
            </Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Thanh vien nhom">
          {(conversation.participants ?? []).map((userId) => {
            const isMe = userId === me?.id;
            const isUserOwner = resolvedSettings.ownerId === userId;
            const isUserAdmin = resolvedSettings.admins.includes(userId);
            const displayName = participantNameMap[userId]
              ?? (isMe ? me?.fullName ?? "Ban" : `User ${userId.slice(0, 8)}`);

            return (
              <View key={userId} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {displayName}
                    {isMe ? " (Ban)" : ""}
                  </Text>
                  <View style={styles.memberBadges}>
                    {isUserOwner ? (
                      <View style={[styles.roleBadge, styles.ownerBadge]}>
                        <Text style={styles.roleBadgeText}>Truong nhom</Text>
                      </View>
                    ) : null}
                    {!isUserOwner && isUserAdmin ? (
                      <View style={[styles.roleBadge, styles.adminBadge]}>
                        <Text style={styles.roleBadgeText}>Pho nhom</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {!isMe ? (
                  <View style={styles.memberActions}>
                    {isOwner ? (
                      <Pressable
                        style={[styles.memberActionButton, styles.primaryActionButton]}
                        disabled={savingKey === `admin-${userId}`}
                        onPress={() => handleToggleAdmin(userId, !isUserAdmin)}
                      >
                        <Text style={styles.primaryActionText}>
                          {isUserAdmin ? "Bo QTV" : "Lam QTV"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {canManageMemberPermissions ? (
                      <Pressable
                        style={[styles.memberActionButton, styles.destructiveActionButton]}
                        onPress={() => handleRemoveMember(userId)}
                      >
                        <Text style={styles.destructiveActionText}>Xoa</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </SectionCard>

        <SectionCard title="Hanh dong">
          {canInviteMembers ? (
            <Pressable
              style={[styles.actionButton, styles.primaryBlockButton]}
              onPress={() => setShowAddMemberModal(true)}
            >
              <Text style={styles.primaryBlockButtonText}>Them thanh vien</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.actionButton} onPress={handleLeaveGroup}>
            <Text style={styles.actionButtonText}>Roi khoi nhom</Text>
          </Pressable>

          {isOwner ? (
            <Pressable
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeleteGroup}
            >
              <Text style={styles.deleteButtonText}>Xoa nhom</Text>
            </Pressable>
          ) : null}
        </SectionCard>
      </ScrollView>

      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chinh sua ten nhom</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nhap ten nhom moi"
              placeholderTextColor={colors.placeholder}
              editable={savingKey !== "name"}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                disabled={savingKey === "name"}
                onPress={() => setShowEditNameModal(false)}
              >
                <Text style={styles.modalButtonText}>Huy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.primaryBlockButton]}
                disabled={savingKey === "name"}
                onPress={() => void handleUpdateName()}
              >
                <Text style={styles.primaryBlockButtonText}>
                  {savingKey === "name" ? "Dang luu..." : "Luu"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <AddGroupMemberModal
        visible={showAddMemberModal}
        conversationId={conversation.id}
        onClose={() => setShowAddMemberModal(false)}
        onSuccess={() => {
          setShowAddMemberModal(false);
          void loadSettings();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.cardElevated,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: "600",
  },
  rowDescription: {
    ...typography.caption1,
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  rowValue: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rowAction: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: "600",
  },
  disabledText: {
    color: colors.muted,
  },
  roleBadgeRow: {
    flexDirection: "row",
  },
  roleBadge: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ownerBadge: {
    backgroundColor: "#FFE9C7",
  },
  adminBadge: {
    backgroundColor: "#DCEBFF",
  },
  roleBadgeText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  switchRowText: {
    flex: 1,
  },
  helperText: {
    ...typography.caption1,
    color: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inviteCard: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bgSecondary,
    padding: spacing.md,
  },
  inviteTitle: {
    ...typography.caption1,
    color: colors.muted,
  },
  inviteCode: {
    ...typography.headline,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  inviteHint: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  memberBadges: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  memberActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  memberActionButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  primaryActionButton: {
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    ...typography.caption1,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  destructiveActionButton: {
    backgroundColor: "#FFE4E1",
  },
  destructiveActionText: {
    ...typography.caption1,
    color: colors.danger,
    fontWeight: "700",
  },
  actionButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  actionButtonText: {
    ...typography.headline,
    color: colors.text,
  },
  primaryBlockButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryBlockButtonText: {
    ...typography.headline,
    color: "#FFFFFF",
  },
  deleteButton: {
    backgroundColor: "#FFF0EE",
    borderColor: "#FFD5D0",
    marginBottom: spacing.md,
  },
  deleteButtonText: {
    ...typography.headline,
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.title3,
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalButton: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  modalButtonText: {
    ...typography.headline,
    color: colors.text,
  },
});
