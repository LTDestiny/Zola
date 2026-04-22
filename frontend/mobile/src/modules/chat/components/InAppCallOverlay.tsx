import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, borderRadius, spacing, typography } from "@/shared/theme/colors";

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

  return (
    <>
      <Modal
        visible={Boolean(incomingCall) && !activeCall}
        transparent
        animationType="fade"
        onRequestClose={onRejectIncoming}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.label}>
              {incomingCall?.mode === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến"}
            </Text>
            <Text style={styles.title}>{incomingCall?.peerDisplayName ?? "Người dùng"}</Text>
            <Text style={styles.subtitle}>Bạn có muốn nhận cuộc gọi này không?</Text>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.btn, styles.rejectBtn]} onPress={onRejectIncoming}>
                <Text style={styles.btnText}>Từ chối</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.acceptBtn]} onPress={onAcceptIncoming}>
                <Text style={styles.acceptBtnText}>Nhận</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(activeCall)}
        transparent={false}
        animationType="slide"
        onRequestClose={onEndCall}
      >
        <View style={styles.activeWrap}>
          <View style={styles.activeHeader}>
            <Text style={styles.activeName}>{activeCall?.peerDisplayName ?? "Cuộc gọi"}</Text>
            <Text style={styles.activeStatus}>
              {activeCall ? getStatusText(activeCall.status) : ""}
              {activeCall?.status === "connected" ? ` · ${callDurationLabel}` : ""}
            </Text>
          </View>

          <View style={styles.centerArea}>
            <Text style={styles.modeText}>
              {activeCall?.mode === "video" ? "Video call" : "Voice call"}
            </Text>
            {activeCall?.status === "connected" && (
              <Text style={styles.durationText}>{callDurationLabel}</Text>
            )}
          </View>

          <View style={styles.controlRow}>
            <Pressable style={[styles.controlBtn, !microphoneEnabled && styles.controlBtnWarn]} onPress={onToggleMicrophone}>
              <Text style={styles.controlText}>{microphoneEnabled ? "Mic bật" : "Mic tắt"}</Text>
            </Pressable>

            {activeCall?.mode === "video" && (
              <Pressable style={[styles.controlBtn, !cameraEnabled && styles.controlBtnWarn]} onPress={onToggleCamera}>
                <Text style={styles.controlText}>{cameraEnabled ? "Cam bật" : "Cam tắt"}</Text>
              </Pressable>
            )}

            <Pressable style={[styles.controlBtn, styles.endBtn]} onPress={onEndCall}>
              <Text style={[styles.controlText, styles.endBtnText]}>Kết thúc</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.cardElevated,
    padding: spacing.lg,
  },
  label: {
    ...typography.caption1,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    ...typography.title2,
    color: colors.text,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btn: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(255,59,48,0.08)",
  },
  acceptBtn: {
    backgroundColor: colors.success,
  },
  btnText: {
    ...typography.subhead,
    color: colors.danger,
    fontWeight: "600",
  },
  acceptBtnText: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  activeWrap: {
    flex: 1,
    backgroundColor: "#0C1620",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  activeHeader: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  activeName: {
    ...typography.title1,
    color: "#FFFFFF",
    textAlign: "center",
  },
  activeStatus: {
    ...typography.body,
    color: "#D1D5DB",
    marginTop: spacing.xs,
  },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  modeText: {
    ...typography.title3,
    color: "#E5E7EB",
  },
  durationText: {
    ...typography.title2,
    color: "#A7F3D0",
    fontWeight: "700",
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  controlBtn: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: "#3B4A5D",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(59,74,93,0.45)",
  },
  controlBtnWarn: {
    borderColor: colors.warning,
    backgroundColor: "rgba(255,149,0,0.25)",
  },
  controlText: {
    ...typography.subhead,
    color: "#F8FAFC",
    fontWeight: "600",
  },
  endBtn: {
    borderColor: colors.danger,
    backgroundColor: "rgba(255,59,48,0.28)",
  },
  endBtnText: {
    color: "#FFE4E6",
  },
});
