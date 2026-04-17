import { useCallback, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-READY TYPING INDICATOR HOOK (WEB)
// Features:
// - Debounce 300ms để không spam socket mỗi ký tự
// - Auto-stop sau 2000ms ngừng gõ
// - Cleanup khi unmount (rời ChatDetail)
// - Gửi typing=false khi send message
// ═══════════════════════════════════════════════════════════════════════════════

const DEBOUNCE_MS = 300;      // Debounce trước khi gửi typing=true
const STOP_TYPING_MS = 2000;  // Tự động tắt typing sau khi ngừng gõ

function log(tag: string, ...args: unknown[]) {
    console.log(`[useTyping][${tag}]`, ...args);
}

type PublishTypingFn = (conversationId: string, typing: boolean) => boolean;

export function useTyping(
    conversationId: string | null,
    publishTyping: PublishTypingFn
) {
    // Refs để tránh stale closures và track state
    const isTypingRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSentRef = useRef<number>(0);
    const conversationIdRef = useRef(conversationId);

    // Update ref when conversationId changes
    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    // ─── SEND TYPING EVENT ───────────────────────────────────────────────────────
    const sendTyping = useCallback((typing: boolean) => {
        const currentConversationId = conversationIdRef.current;
        if (!currentConversationId) return;

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

        // Rate limiting: không gửi quá nhanh (min 500ms giữa các lần)
        if (typing && now - lastSentRef.current < 500) {
            return;
        }

        log("send", { conversationId: currentConversationId, typing });
        isTypingRef.current = typing;
        lastSentRef.current = now;

        // Gửi qua socket
        publishTyping(currentConversationId, typing);

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
    }, [publishTyping]);

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

    // ─── CLEANUP ON UNMOUNT OR CONVERSATION CHANGE ───────────────────────────────
    useEffect(() => {
        return () => {
            log("cleanup", conversationIdRef.current);

            // Clear all timers
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (stopTypingTimerRef.current) {
                clearTimeout(stopTypingTimerRef.current);
            }

            // Send typing=false when leaving
            if (isTypingRef.current && conversationIdRef.current) {
                publishTyping(conversationIdRef.current, false);
                isTypingRef.current = false;
            }
        };
    }, [conversationId, publishTyping]);

    // Reset typing state when conversation changes
    useEffect(() => {
        // Clear timers when switching conversations
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (stopTypingTimerRef.current) {
            clearTimeout(stopTypingTimerRef.current);
            stopTypingTimerRef.current = null;
        }
        isTypingRef.current = false;
    }, [conversationId]);

    return {
        onTextChange,
        onSendMessage,
        stopTyping: () => sendTyping(false),
    };
}
