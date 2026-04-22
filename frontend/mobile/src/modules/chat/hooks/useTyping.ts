import { useCallback, useEffect, useRef } from "react";
import { useSocketStore } from "@/modules/chat/store/socketStore";
import { useChatStore } from "@/modules/chat/store/chatStore";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY TYPING INDICATOR HOOK
// Features:
// - Debounce 300ms để không spam socket mỗi ký tự
// - Auto-stop sau 2000ms ngừng gõ
// - Cleanup khi unmount (rời ChatDetail)
// - Gửi typing=false khi send message
// - Connection check trước khi gửi
// - Force reconnect nếu disconnected
// ═══════════════════════════════════════════════════════════════════════════════

const DEBOUNCE_MS = 300;      // Debounce trước khi gửi typing=true
const STOP_TYPING_MS = 2000;  // Tự động tắt typing sau khi ngừng gõ
const MIN_SEND_INTERVAL_MS = 500; // Rate limiting giữa các lần gửi
const DEBUG = false;

function log(tag: string, ...args: unknown[]) {
    if (DEBUG) {
        console.log(`[useTyping][${tag}]`, ...args);
    }
}

export function useTyping(
    conversationId: string,
    conversationType: "private" | "group" = "private",
) {
    const publishTyping = useSocketStore((s) => s.publishTyping);
    const connected = useSocketStore((s) => s.connected);
    const forceReconnect = useSocketStore((s) => s.forceReconnect);
    const setTypingLocal = useChatStore((s) => s.setTyping);

    // Refs để tránh stale closures và track state
    const isTypingRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSentRef = useRef<number>(0);
    const reconnectAttemptedRef = useRef(false);

    // ─── SEND TYPING EVENT ───────────────────────────────────────────────────────
    const sendTyping = useCallback((typing: boolean) => {
        const now = Date.now();

        // Prevent duplicate events
        if (isTypingRef.current === typing) {
            // Nếu đang typing, reset stop timer
            if (typing && stopTypingTimerRef.current) {
                clearTimeout(stopTypingTimerRef.current);
                stopTypingTimerRef.current = setTimeout(() => {
                    sendTyping(false);
                }, STOP_TYPING_MS);
            }
            return;
        }

        // Rate limiting: không gửi quá nhanh
        if (typing && now - lastSentRef.current < MIN_SEND_INTERVAL_MS) {
            return;
        }

        log("send", { conversationId, typing, connected });
        isTypingRef.current = typing;
        lastSentRef.current = now;

        // Gửi qua socket (async but fire-and-forget)
        // publishTyping tự handle connection waiting
        void publishTyping(conversationId, typing, conversationType).catch((err) => {
            log("send-error", "Failed to publish typing:", err);
        });

        // Nếu bắt đầu typing, set timer tự động stop
        if (typing) {
            if (stopTypingTimerRef.current) {
                clearTimeout(stopTypingTimerRef.current);
            }
            stopTypingTimerRef.current = setTimeout(() => {
                sendTyping(false);
            }, STOP_TYPING_MS);
        } else {
            // Clear stop timer khi đã stop
            if (stopTypingTimerRef.current) {
                clearTimeout(stopTypingTimerRef.current);
                stopTypingTimerRef.current = null;
            }
        }
    }, [connected, conversationId, conversationType, publishTyping]);

    // ─── HANDLE TEXT CHANGE (với debounce) ───────────────────────────────────────
    const onTextChange = useCallback((text: string) => {
        const hasText = text.trim().length > 0;

        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (hasText) {
            // Nếu chưa typing, debounce trước khi gửi
            if (!isTypingRef.current) {
                debounceTimerRef.current = setTimeout(() => {
                    sendTyping(true);
                }, DEBOUNCE_MS);
            } else {
                // Đã typing, reset stop timer
                if (stopTypingTimerRef.current) {
                    clearTimeout(stopTypingTimerRef.current);
                }
                stopTypingTimerRef.current = setTimeout(() => {
                    sendTyping(false);
                }, STOP_TYPING_MS);
            }
        } else {
            // Text rỗng → stop typing ngay
            sendTyping(false);
        }
    }, [sendTyping]);

    // ─── HANDLE SEND MESSAGE ─────────────────────────────────────────────────────
    const onSendMessage = useCallback(() => {
        // Clear all timers
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (stopTypingTimerRef.current) {
            clearTimeout(stopTypingTimerRef.current);
            stopTypingTimerRef.current = null;
        }

        // Stop typing immediately
        if (isTypingRef.current) {
            sendTyping(false);
        }
    }, [sendTyping]);

    // ─── CLEANUP ON UNMOUNT ──────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            log("cleanup", conversationId);

            // Clear all timers
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (stopTypingTimerRef.current) {
                clearTimeout(stopTypingTimerRef.current);
            }

            // Send typing=false when leaving (fire-and-forget)
            if (isTypingRef.current) {
                // Don't await, just fire
                void publishTyping(conversationId, false, conversationType).catch(() => undefined);
                isTypingRef.current = false;
            }
        };
    }, [conversationId, conversationType, publishTyping]);

    // ─── AUTO-RECONNECT CHECK ────────────────────────────────────────────────────
    // When user starts typing but socket is disconnected, try to reconnect once
    useEffect(() => {
        if (!connected && isTypingRef.current && !reconnectAttemptedRef.current) {
            log("reconnect-check", "User typing but disconnected, triggering reconnect...");
            reconnectAttemptedRef.current = true;
            forceReconnect();
        }

        // Reset reconnect flag when connected
        if (connected) {
            reconnectAttemptedRef.current = false;
        }
    }, [connected, forceReconnect]);

    return {
        onTextChange,
        onSendMessage,
        stopTyping: () => sendTyping(false),
        isConnected: connected,
    };
}
