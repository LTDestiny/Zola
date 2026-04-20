import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from "lucide-react";

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
  language: "vi" | "en";
  incomingCall: IncomingCallView | null;
  activeCall: ActiveCallView | null;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  onAcceptIncoming: () => void;
  onRejectIncoming: () => void;
  onEndCall: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
};

function toInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusText(status: InAppCallStatus, language: "vi" | "en") {
  if (status === "calling") {
    return language === "vi" ? "Dang goi..." : "Calling...";
  }
  if (status === "ringing") {
    return language === "vi" ? "Dang do chuong..." : "Ringing...";
  }
  if (status === "connecting") {
    return language === "vi" ? "Dang ket noi..." : "Connecting...";
  }
  return language === "vi" ? "Da ket noi" : "Connected";
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function RemoteVideoTile({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="h-full w-full rounded-xl bg-black object-cover"
    />
  );
}

export function InAppCallOverlay({
  language,
  incomingCall,
  activeCall,
  localStream,
  remoteStreams,
  microphoneEnabled,
  cameraEnabled,
  onAcceptIncoming,
  onRejectIncoming,
  onEndCall,
  onToggleMicrophone,
  onToggleCamera,
}: InAppCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!activeCall) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeCall?.callId]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-wide text-indigo-300">
              {incomingCall.mode === "video"
                ? language === "vi"
                  ? "Cuoc goi video den"
                  : "Incoming video call"
                : language === "vi"
                  ? "Cuoc goi thoai den"
                  : "Incoming voice call"}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {incomingCall.peerDisplayName}
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              {language === "vi"
                ? "Ban co muon nhan cuoc goi nay khong?"
                : "Do you want to answer this call?"}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onRejectIncoming}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/60 px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10"
              >
                <X size={16} />
                {language === "vi" ? "Tu choi" : "Decline"}
              </button>
              <button
                type="button"
                onClick={onAcceptIncoming}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                <Phone size={16} />
                {language === "vi" ? "Nhan" : "Answer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCall && (
        <div className="fixed inset-0 z-[79] bg-slate-950">
          <div className="relative h-full w-full overflow-hidden">
            {activeCall.mode === "video" ? (
              remoteStreams.length > 0 ? (
                <div
                  className={`grid h-full w-full gap-2 p-2 ${
                    remoteStreams.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {remoteStreams.map((stream, index) => (
                    <RemoteVideoTile key={`${activeCall.callId}-${index}`} stream={stream} />
                  ))}
                </div>
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-center">
                  <div>
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-indigo-500/30 text-3xl font-bold text-indigo-100">
                      {toInitials(activeCall.peerDisplayName)}
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">
                      {activeCall.peerDisplayName}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {getStatusText(activeCall.status, language)}
                    </p>
                    {activeCall.status === "connected" && (
                      <p className="mt-1 text-sm font-semibold text-emerald-200">
                        {callDurationLabel}
                      </p>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-center">
                <div>
                  <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-indigo-500/30 text-4xl font-bold text-indigo-100">
                    {toInitials(activeCall.peerDisplayName)}
                  </div>
                  <p className="mt-4 text-xl font-semibold text-white">
                    {activeCall.peerDisplayName}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {getStatusText(activeCall.status, language)}
                  </p>
                  {activeCall.status === "connected" && (
                    <p className="mt-1 text-sm font-semibold text-emerald-200">
                      {callDurationLabel}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeCall.mode === "video" && localStream && (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="absolute right-4 top-4 h-36 w-24 rounded-xl border border-slate-600 bg-black object-cover shadow-xl sm:h-44 sm:w-32"
              />
            )}

            <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-slate-950/70 to-transparent p-5">
              <div className="pointer-events-auto inline-flex rounded-lg bg-slate-900/70 px-3 py-1 text-sm text-slate-100 backdrop-blur">
                {activeCall.peerDisplayName} · {getStatusText(activeCall.status, language)}
                {activeCall.status === "connected" ? ` · ${callDurationLabel}` : ""}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-8 pt-10">
              <button
                type="button"
                onClick={onToggleMicrophone}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${microphoneEnabled ? "border-slate-400 bg-slate-700/70 hover:bg-slate-700" : "border-amber-300 bg-amber-600/80 hover:bg-amber-600"}`}
                title={language === "vi" ? "Bat/tat micro" : "Toggle microphone"}
              >
                {microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {activeCall.mode === "video" && (
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${cameraEnabled ? "border-slate-400 bg-slate-700/70 hover:bg-slate-700" : "border-amber-300 bg-amber-600/80 hover:bg-amber-600"}`}
                  title={language === "vi" ? "Bat/tat camera" : "Toggle camera"}
                >
                  {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              )}

              <button
                type="button"
                onClick={onEndCall}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500"
                title={language === "vi" ? "Ket thuc cuoc goi" : "End call"}
              >
                <PhoneOff size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
