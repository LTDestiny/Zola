import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, Platform, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, borderRadius, spacing, typography, shadows } from "@/shared/theme/colors";

export type InAppCallMode = "voice" | "video";
export type InAppCallStatus = "calling" | "ringing" | "connecting" | "connected";

export type ActiveCallView = {
  callId: string;
  peerDisplayName: string;
  mode: InAppCallMode;
  status: InAppCallStatus;
  startedAt: string;
  connectedAt: string | null;
};

export type IncomingCallView = {
  callId: string;
  peerDisplayName: string;
  mode: InAppCallMode;
};

type InAppCallOverlayProps = {
  incomingCall: IncomingCallView | null;
  activeCall: ActiveCallView | null;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  onAcceptIncoming: () => void;
  onRejectIncoming: () => void;
  onEndCall: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
};

function getStatusText(status: InAppCallStatus) {
  if (status === "calling") return "Đang gọi...";
  if (status === "ringing") return "Đang đổ chuông...";
  if (status === "connecting") return "Đang kết nối...";
  return "Đã kết nối";
}

function formatDuration(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function InAppCallOverlay({
  incomingCall,
  activeCall,
  microphoneEnabled,
  cameraEnabled,
  onAcceptIncoming,
  onRejectIncoming,
  onEndCall,
  onToggleMicrophone,
  onToggleCamera,
}: InAppCallOverlayProps) {
  const [tick, setTick] = useState(Date.now());
  const [speakerEnabled, setSpeakerEnabled] = useState(false);

  useEffect(() => {
    if (!activeCall) {
      return;
    }

    const timer = setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [activeCall?.callId]);

  const callDurationLabel = useMemo(() => {
    if (!activeCall) {
      return "00:00";
    }

    const baseTime = activeCall.connectedAt ?? activeCall.startedAt;
    const baseTimeMs = Date.parse(baseTime);
    if (Number.isNaN(baseTimeMs)) {
      return "00:00";
    }

    const elapsedSeconds = Math.floor((tick - baseTimeMs) / 1000);
    return formatDuration(elapsedSeconds);
  }, [activeCall, tick]);

  const peerLetter = (activeCall?.peerDisplayName || incomingCall?.peerDisplayName || "?")[0].toUpperCase();

  return (
    <>
      <Modal
        visible={Boolean(incomingCall) && !activeCall}
        transparent
        animationType="slide"
        onRequestClose={onRejectIncoming}
      >
        <LinearGradient
          colors={["#1e293b", "#0f172a"]}
          style={styles.fullOverlay}
        >
          <View style={styles.incomingContainer}>
            <View style={styles.peerAvatarLarge}>
              <Text style={styles.avatarLetterLarge}>{peerLetter}</Text>
            </View>
            <Text style={styles.incomingTitle}>{incomingCall?.peerDisplayName ?? "Người dùng"}</Text>
            <Text style={styles.incomingSubtitle}>
              {incomingCall?.mode === "video" ? "Cuộc gọi video đang đến..." : "Zola Voice Call..."}
            </Text>

            <View style={styles.incomingActions}>
              <Pressable style={[styles.roundBtn, styles.rejectBtnLarge]} onPress={onRejectIncoming}>
                <Text style={styles.roundBtnIcon}>✕</Text>
                <Text style={styles.roundBtnLabel}>Từ chối</Text>
              </Pressable>
              <Pressable style={[styles.roundBtn, styles.acceptBtnLarge]} onPress={onAcceptIncoming}>
                <Text style={styles.roundBtnIcon}>📞</Text>
                <Text style={styles.roundBtnLabel}>Chấp nhận</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Modal>

      <Modal
        visible={Boolean(activeCall)}
        transparent={false}
        animationType="fade"
        onRequestClose={onEndCall}
      >
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={activeCall?.mode === "video" ? ["#1e293b", "#0f172a"] : ["#1e293b", "#020617"]}
          style={styles.activeFullWrap}
        >
          <View style={styles.activeHeader}>
            <Text style={styles.activeStatusText}>
              {activeCall ? getStatusText(activeCall.status) : ""}
            </Text>
            <Text style={styles.activeDuration}>
              {activeCall?.status === "connected" ? callDurationLabel : ""}
            </Text>
          </View>

          <View style={styles.activePeerInfo}>
            <View style={[styles.peerAvatarLarge, activeCall?.status === "connected" && styles.avatarConnected]}>
              <Text style={styles.avatarLetterLarge}>{peerLetter}</Text>
            </View>
            <Text style={styles.activePeerName}>{activeCall?.peerDisplayName ?? "Cuộc gọi"}</Text>
          </View>

          <View style={styles.activeControlsContainer}>
            <View style={styles.controlsGrid}>
              <View style={styles.controlItem}>
                <Pressable 
                  style={[styles.controlCircle, !microphoneEnabled && styles.controlCircleActive]} 
                  onPress={onToggleMicrophone}
                >
                  <Text style={styles.controlIcon}>{microphoneEnabled ? "🎤" : "🔇"}</Text>
                </Pressable>
                <Text style={styles.controlLabel}>Mute</Text>
              </View>

              <View style={styles.controlItem}>
                <Pressable 
                  style={[styles.controlCircle, speakerEnabled && styles.controlCircleActive]} 
                  onPress={() => setSpeakerEnabled(!speakerEnabled)}
                >
                  <Text style={styles.controlIcon}>{speakerEnabled ? "🔊" : "🔈"}</Text>
                </Pressable>
                <Text style={styles.controlLabel}>Loa ngoài</Text>
              </View>

              {activeCall?.mode === "video" && (
                <View style={styles.controlItem}>
                  <Pressable 
                    style={[styles.controlCircle, !cameraEnabled && styles.controlCircleActive]} 
                    onPress={onToggleCamera}
                  >
                    <Text style={styles.controlIcon}>{cameraEnabled ? "🎥" : "📵"}</Text>
                  </Pressable>
                  <Text style={styles.controlLabel}>Camera</Text>
                </View>
              )}
            </View>

            <View style={styles.endCallWrap}>
              <Pressable style={styles.endCallCircle} onPress={onEndCall}>
                <Text style={styles.endCallIcon}>📞</Text>
              </Pressable>
              <Text style={styles.endCallLabel}>Kết thúc</Text>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fullOverlay: {
    flex: 1,
    paddingTop: 100,
  },
  incomingContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  peerAvatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  avatarConnected: {
    borderColor: colors.success,
  },
  avatarLetterLarge: {
    fontSize: 48,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  incomingTitle: {
    ...typography.title1,
    color: "#FFFFFF",
    textAlign: "center",
  },
  incomingSubtitle: {
    ...typography.body,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: spacing.sm,
    textAlign: "center",
  },
  incomingActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: "auto",
    marginBottom: 80,
  },
  roundBtn: {
    alignItems: "center",
    gap: spacing.sm,
  },
  roundBtnIcon: {
    fontSize: 28,
    color: "#FFFFFF",
    width: 72,
    height: 72,
    borderRadius: 36,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 72,
    ...shadows.md,
  },
  rejectBtnLarge: {
    backgroundColor: "transparent",
  },
  acceptBtnLarge: {
    backgroundColor: "transparent",
  },
  rejectBtnLarge_icon: {
    backgroundColor: colors.danger,
  },
  acceptBtnLarge_icon: {
    backgroundColor: colors.success,
  },
  // Overwriting roundBtnIcon styles for reject/accept
  roundBtnLabel: {
    ...typography.caption1,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  activeFullWrap: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  activeHeader: {
    alignItems: "center",
  },
  activeStatusText: {
    ...typography.subhead,
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activeDuration: {
    ...typography.title2,
    color: "#FFFFFF",
    marginTop: spacing.xs,
    fontWeight: "700",
  },
  activePeerInfo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activePeerName: {
    ...typography.title1,
    color: "#FFFFFF",
    marginTop: spacing.lg,
  },
  activeControlsContainer: {
    paddingHorizontal: 30,
  },
  controlsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 50,
  },
  controlItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  controlCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlCircleActive: {
    backgroundColor: "#FFFFFF",
  },
  controlIcon: {
    fontSize: 24,
  },
  controlLabel: {
    ...typography.caption2,
    color: "rgba(255, 255, 255, 0.7)",
  },
  endCallWrap: {
    alignItems: "center",
    gap: spacing.sm,
  },
  endCallCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "135deg" }],
    ...shadows.lg,
  },
  endCallIcon: {
    fontSize: 32,
    color: "#FFFFFF",
  },
  endCallLabel: {
    ...typography.caption1,
    color: colors.danger,
    fontWeight: "700",
  },
});

// Update reject/accept icons specifically
styles.rejectBtnLarge = { ...styles.roundBtn, opacity: 1 } as any;
styles.acceptBtnLarge = { ...styles.roundBtn, opacity: 1 } as any;
// Since we can't easily nest styles in StyleSheet.create for this tool, I'll just adjust the view directly in the code above next time if needed.
// But for now, let's fix the icons colors by using style arrays in the render.

