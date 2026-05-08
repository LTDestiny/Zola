import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { pickMediaFromLibrary, uploadMedia } from "@/modules/chat/api/mediaApi";
import { colors, spacing, typography, borderRadius, shadows } from "@/shared/theme/colors";
import { getInitials, resolveMediaUrl } from "@/modules/profile/utils/profileFormat";

type Props = {
  fullName?: string | null;
  avatarUrl?: string | null;
  uploading?: boolean;
  onUploadingChange?: (value: boolean) => void;
  onUploaded: (avatarUrl: string) => void;
};

export function AvatarUploader({
  fullName,
  avatarUrl,
  uploading,
  onUploadingChange,
  onUploaded,
}: Props) {
  const resolvedAvatar = resolveMediaUrl(avatarUrl);

  const handlePickAvatar = async () => {
    if (uploading) return;

    onUploadingChange?.(true);
    try {
      const asset = await pickMediaFromLibrary();
      if (!asset) return;

      if (asset.type === "video") {
        Alert.alert("Avatar upload", "Please choose an image for your avatar.");
        return;
      }

      const uploaded = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      onUploaded(uploaded.data.fileUrl);
    } catch {
      Alert.alert("Avatar upload", "Unable to upload avatar. Please try again.");
    } finally {
      onUploadingChange?.(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {resolvedAvatar ? (
          <Image source={{ uri: resolvedAvatar }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </View>
      <Pressable
        onPress={() => void handlePickAvatar()}
        accessibilityRole="button"
        accessibilityLabel="Upload avatar"
        disabled={uploading}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, uploading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{uploading ? "Uploading..." : "Upload avatar"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: colors.avatarBg,
    ...shadows.sm,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.title3,
    color: colors.avatarText,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  button: {
    minHeight: 44,
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardElevated,
    paddingHorizontal: spacing.md,
  },
  buttonPressed: {
    backgroundColor: colors.bgSecondary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
});
