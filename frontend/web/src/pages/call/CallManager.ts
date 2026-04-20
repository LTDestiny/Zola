export type CallLifecycleState =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended";

export type CallLifecycleEvent =
  | "OUTGOING_START"
  | "INCOMING_INVITE"
  | "REMOTE_ACCEPTED"
  | "LOCAL_ACCEPTED"
  | "PEER_CONNECTED"
  | "TIMEOUT"
  | "END"
  | "RESET";

type CallManagerOptions = {
  onStateChange?: (
    previous: CallLifecycleState,
    next: CallLifecycleState,
    event: CallLifecycleEvent,
  ) => void;
  onUnansweredTimeout?: (callId: string) => void;
  onInviteRetry?: (callId: string) => void;
  retryIntervalMs?: number;
  unansweredTimeoutMs?: number;
};

const DEFAULT_RETRY_INTERVAL_MS = 2000;
const DEFAULT_UNANSWERED_TIMEOUT_MS = 30000;

const TRANSITIONS: Record<CallLifecycleState, Partial<Record<CallLifecycleEvent, CallLifecycleState>>> = {
  idle: {
    OUTGOING_START: "calling",
    INCOMING_INVITE: "ringing",
    RESET: "idle",
  },
  calling: {
    REMOTE_ACCEPTED: "connecting",
    PEER_CONNECTED: "connected",
    TIMEOUT: "ended",
    END: "ended",
    RESET: "idle",
  },
  ringing: {
    LOCAL_ACCEPTED: "connecting",
    END: "ended",
    RESET: "idle",
  },
  connecting: {
    PEER_CONNECTED: "connected",
    END: "ended",
    TIMEOUT: "ended",
    RESET: "idle",
  },
  connected: {
    END: "ended",
    RESET: "idle",
  },
  ended: {
    RESET: "idle",
    OUTGOING_START: "calling",
    INCOMING_INVITE: "ringing",
  },
};

export class CallManager {
  private state: CallLifecycleState = "idle";
  private activeCallId: string | null = null;
  private inviteRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private unansweredTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: Required<
    Pick<CallManagerOptions, "retryIntervalMs" | "unansweredTimeoutMs">
  > &
    Omit<CallManagerOptions, "retryIntervalMs" | "unansweredTimeoutMs">;

  constructor(options?: CallManagerOptions) {
    this.options = {
      retryIntervalMs: options?.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
      unansweredTimeoutMs:
        options?.unansweredTimeoutMs ?? DEFAULT_UNANSWERED_TIMEOUT_MS,
      onInviteRetry: options?.onInviteRetry,
      onStateChange: options?.onStateChange,
      onUnansweredTimeout: options?.onUnansweredTimeout,
    };
  }

  getState(): CallLifecycleState {
    return this.state;
  }

  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  transition(event: CallLifecycleEvent, callId?: string): CallLifecycleState {
    const previous = this.state;
    const target = TRANSITIONS[previous][event] ?? previous;
    this.state = target;

    if (event === "OUTGOING_START" || event === "INCOMING_INVITE") {
      this.activeCallId = callId ?? this.activeCallId;
    }

    if (event === "REMOTE_ACCEPTED" || event === "LOCAL_ACCEPTED" || event === "PEER_CONNECTED") {
      this.stopInviteRetry();
      this.stopUnansweredTimer();
    }

    if (event === "END" || event === "TIMEOUT") {
      this.stopInviteRetry();
      this.stopUnansweredTimer();
    }

    if (event === "RESET") {
      this.stopInviteRetry();
      this.stopUnansweredTimer();
      this.activeCallId = null;
    }

    if (previous !== target) {
      this.options.onStateChange?.(previous, target, event);
    }

    return this.state;
  }

  startOutgoingGuards(callId: string) {
    this.activeCallId = callId;
    this.startInviteRetry(callId);
    this.startUnansweredTimer(callId);
  }

  stopOutgoingGuards() {
    this.stopInviteRetry();
    this.stopUnansweredTimer();
  }

  dispose() {
    this.stopInviteRetry();
    this.stopUnansweredTimer();
    this.activeCallId = null;
    this.state = "idle";
  }

  private startInviteRetry(callId: string) {
    this.stopInviteRetry();

    const tick = () => {
      if (this.activeCallId !== callId) {
        return;
      }
      this.options.onInviteRetry?.(callId);
      this.inviteRetryTimer = setTimeout(tick, this.options.retryIntervalMs);
    };

    this.inviteRetryTimer = setTimeout(tick, this.options.retryIntervalMs);
  }

  private stopInviteRetry() {
    if (this.inviteRetryTimer) {
      clearTimeout(this.inviteRetryTimer);
      this.inviteRetryTimer = null;
    }
  }

  private startUnansweredTimer(callId: string) {
    this.stopUnansweredTimer();

    this.unansweredTimer = setTimeout(() => {
      if (this.activeCallId !== callId) {
        return;
      }
      this.transition("TIMEOUT", callId);
      this.options.onUnansweredTimeout?.(callId);
    }, this.options.unansweredTimeoutMs);
  }

  private stopUnansweredTimer() {
    if (this.unansweredTimer) {
      clearTimeout(this.unansweredTimer);
      this.unansweredTimer = null;
    }
  }
}
