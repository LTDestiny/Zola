import { useCallback, useState } from "react";
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
import { addGroupMember, searchUserByEmail, toApiErrorMessage } from "@/modules/chat/api/chatApi";
import { colors, spacing, typography, borderRadius } from "@/shared/theme/colors";

type Props = {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddGroupMemberModal({
  visible,
  conversationId,
  onClose,
  onSuccess,
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddMember = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập email");
      return;
    }

    setLoading(true);
    try {
      const userResponse = await searchUserByEmail(email.trim());
      const userId = userResponse.data.id;

      await addGroupMember(conversationId, userId);
      Alert.alert("Thông báo", "Thêm thành viên thành công");
      setEmail("");
      onClose();
      onSuccess();
    } catch (error) {
      Alert.alert("Thông báo", toApiErrorMessage(error) || "Không thể thêm thành viên");
    } finally {
      setLoading(false);
    }
  }, [email, conversationId, onClose, onSuccess]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Thêm thành viên nhóm</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập email người dùng"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.actions}>
            <Pressable
              style={styles.button}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleAddMember}
              disabled={loading}
            >
              <Text style={styles.buttonPrimaryText}>
                {loading ? "Đang thêm..." : "Thêm"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.cardElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minWidth: "80%",
  },
  title: {
    ...typography.title1,
    marginBottom: spacing.md,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    ...typography.headline,
    color: colors.text,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    ...typography.headline,
    color: "white",
  },
});
