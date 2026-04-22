import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  getGroupSettings,
  updateGroupSettings,
  removeGroupMember,
  setGroupAdmin,
  leaveGroupConversation,
  deleteGroupConversation,
  toApiErrorMessage,
} from "@/modules/chat/api/chatApi";
import { AddGroupMemberModal } from "@/modules/chat/components/AddGroupMemberModal";
import { useAuthStore } from "@/modules/auth/authStore";
import type { ChatStackParamList } from "@/shared/types/navigation";
import type { ConversationItem, GroupSettings } from "@/shared/types/api";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "GroupSettings">;

export function GroupSettingsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const conversation = route.params.conversation;
  const me = useAuthStore((s) => s.me);

  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const isAdmin = conversation.admins?.includes(me?.id ?? "") ?? false;
  const isOwner = conversation.ownerId === me?.id;

  useEffect(() => {
    void loadSettings();
  }, [conversation.id]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGroupSettings(conversation.id);
      setSettings(response.data);
      setEditName(response.data.name ?? "");
    } catch (error) {
      Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể tải cài đặt nhóm");
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  const handleUpdateName = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert("Thông báo", "Tên nhóm không được để trống");
      return;
    }

    setSaving(true);
    try {
      const response = await updateGroupSettings(conversation.id, {
        name: editName.trim(),
      });
      setSettings(response.data);
      setShowEditNameModal(false);
      Alert.alert("Thông báo", "Cập nhật tên nhóm thành công");
    } catch (error) {
      Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể cập nhật tên nhóm");
    } finally {
      setSaving(false);
    }
  }, [conversation.id, editName]);

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!isAdmin && !isOwner) {
        Alert.alert("Thông báo", "Chỉ quản trị viên mới có thể xóa thành viên");
        return;
      }

      Alert.alert(
        "Xác nhận",
        "Bạn có chắc muốn xóa thành viên này khỏi nhóm?",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xóa",
            style: "destructive",
            onPress: async () => {
              try {
                await removeGroupMember(conversation.id, userId);
                Alert.alert("Thông báo", "Xóa thành viên thành công");
                await loadSettings();
              } catch (error) {
                Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể xóa thành viên");
              }
            },
          },
        ],
      );
    },
    [conversation.id, isAdmin, isOwner, loadSettings],
  );

  const handleSetAdmin = useCallback(
    async (userId: string, admin: boolean) => {
      if (!isOwner) {
        Alert.alert("Thông báo", "Chỉ chủ nhóm mới có thể thay đổi quản trị viên");
        return;
      }

      try {
        await setGroupAdmin(conversation.id, userId, admin);
        Alert.alert("Thông báo", `${admin ? "Thêm" : "Xóa"} quản trị viên thành công`);
        await loadSettings();
      } catch (error) {
        Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể thay đổi quản trị viên");
      }
    },
    [conversation.id, isOwner, loadSettings],
  );

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      "Xác nhận",
      "Bạn chắc chắn muốn rời khỏi nhóm?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Rời",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroupConversation(conversation.id);
              navigation.navigate("ChatList");
            } catch (error) {
              Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể rời nhóm");
            }
          },
        },
      ],
    );
  }, [conversation.id, navigation]);

  const handleDeleteGroup = useCallback(() => {
    if (!isOwner) {
      Alert.alert("Thông báo", "Chỉ chủ nhóm mới có thể xóa nhóm");
      return;
    }

    Alert.alert(
      "Xác nhận",
      "Bạn chắc chắn muốn xóa nhóm? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroupConversation(conversation.id);
              navigation.navigate("ChatList");
            } catch (error) {
              Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể xóa nhóm");
            }
          },
        },
      ],
    );
  }, [conversation.id, isOwner, navigation]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin nhóm</Text>

          <Pressable
            style={styles.infoRow}
            onPress={() => {
              if (isAdmin || isOwner) {
                setShowEditNameModal(true);
              }
            }}
          >
            <Text style={styles.infoLabel}>Tên nhóm</Text>
            <Text style={styles.infoValue}>{settings?.name ?? "Chưa xác định"}</Text>
          </Pressable>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thành viên</Text>
            <Text style={styles.infoValue}>{conversation.participants?.length ?? 0}</Text>
          </View>
        </View>

        {/* Members */}
        {conversation.participants && conversation.participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thành viên</Text>
            {conversation.participants.map((userId) => {
              const isMe = userId === me?.id;
              const isUserAdmin = conversation.admins?.includes(userId) ?? false;

              return (
                <View key={userId} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {isMe ? `${me?.fullName} (Bạn)` : `User ${userId.slice(0, 8)}`}
                    </Text>
                    {isUserAdmin && <Text style={styles.adminBadge}>Quản trị viên</Text>}
                  </View>

                  {(isAdmin || isOwner) && !isMe && (
                    <View style={styles.memberActions}>
                      {isOwner && (
                        <Pressable
                          style={styles.adminToggleButton}
                          onPress={() => handleSetAdmin(userId, !isUserAdmin)}
                        >
                          <Text style={styles.adminToggleText}>
                            {isUserAdmin ? "Bỏ QTV" : "Làm QTV"}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(userId)}
                      >
                        <Text style={styles.removeButtonText}>Xóa</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          {(isAdmin || isOwner) && (
            <Pressable
              style={styles.actionButton}
              onPress={() => setShowAddMemberModal(true)}
            >
              <Text style={styles.actionButtonText}>➕ Thêm thành viên</Text>
            </Pressable>
          )}

          <Pressable style={styles.actionButton} onPress={handleLeaveGroup}>
            <Text style={styles.actionButtonText}>Rời khỏi nhóm</Text>
          </Pressable>

          {isOwner && (
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDeleteGroup}>
              <Text style={styles.deleteButtonText}>Xóa nhóm</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chỉnh sửa tên nhóm</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Tên nhóm mới"
              placeholderTextColor={colors.placeholder}
              editable={!saving}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setShowEditNameModal(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleUpdateName}
                disabled={saving}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {saving ? "Đang lưu..." : "Lưu"}
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
        onSuccess={() => void loadSettings()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  loadingText: {
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.callout,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  infoRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    color: colors.text,
  },
  adminBadge: {
    ...typography.caption1,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  memberActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  adminToggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  adminToggleText: {
    ...typography.caption1,
    color: "white",
  },
  removeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
  },
  removeButtonText: {
    ...typography.caption1,
    color: "white",
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    ...typography.headline,
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    ...typography.headline,
    color: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minWidth: "80%",
  },
  modalTitle: {
    ...typography.title1,
    marginBottom: spacing.md,
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  modalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  modalButtonText: {
    ...typography.headline,
    color: colors.text,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonPrimaryText: {
    ...typography.headline,
    color: "white",
  },
});
