package com.zola.common.events;

/**
 * Shared Kafka topics used by producers/consumers across services.
 */
public final class Topics {

    private Topics() {
    }

    public static final String CHAT_MESSAGE_SENT_V1 = "zola.chat.message.sent.v1";
    public static final String CHAT_MESSAGE_RECALLED_V1 = "zola.chat.message.recalled.v1";
    public static final String CALL_SIGNAL_V1 = "zola.call.signal.v1";
    public static final String NOTIFICATION_CREATED_V1 = "zola.notification.created.v1";
}
