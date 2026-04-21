// modules/chat/socket/socketTypes.ts

export type ChatRealtimeEvent =
    | {
        eventType: "MESSAGE_SENT" | "NEW_MESSAGE";
        conversationId?: string;
        message: {
            // Backend sends messageId, but we transform to id in useSocket
            messageId?: string;
            id?: string;
            conversationId: string;
            senderId: string;
            receiverId?: string | null;
            type?: string;
            content: string;
            fileUrl?: string | null;
            fileName?: string | null;
            reactions?: string[];
            deletedForUsers?: string[];
            deliveredTo?: string[];
            seenBy?: string[];
            createdAt: string;
            updatedAt?: string;
            recalled?: boolean;
            edited?: boolean;
        };
    }
    | {
        eventType: "CONVERSATION_UPDATED";
        conversationId: string;
        unreadCount?: number | null;
        totalUnreadCount?: number | null;
        lastMessage?: string | null;
        lastMessageAt?: string | null;
    }
    | {
        eventType: "TYPING";
        conversationId?: string;
        typing: boolean;
        userId?: string;
    }
    | {
        eventType: "PRESENCE_UPDATED";
        userId: string;
        online: boolean;
        lastSeenAt?: string;
    }
    | {
        eventType: "FRIENDSHIP_REQUEST_RECEIVED";
        userId: string;
    }
    | {
        eventType: "READ_RECEIPT";
        conversationId?: string;
        actorId: string;
        message: {
            messageId?: string;
            id?: string;
            conversationId: string;
            senderId: string;
            receiverId?: string | null;
            type?: string;
            content: string;
            fileUrl?: string | null;
            fileName?: string | null;
            reactions?: string[];
            deletedForUsers?: string[];
            deliveredTo?: string[];
            seenBy?: string[];
            createdAt: string;
            updatedAt?: string;
            recalled?: boolean;
            edited?: boolean;
        };
    }
    | {
        eventType: "MESSAGE_RECALLED";
        conversationId?: string;
        message: {
            messageId?: string;
            id?: string;
            conversationId: string;
            senderId: string;
            receiverId?: string | null;
            type?: string;
            content: string;
            fileUrl?: string | null;
            fileName?: string | null;
            reactions?: string[];
            deletedForUsers?: string[];
            deliveredTo?: string[];
            seenBy?: string[];
            createdAt: string;
            updatedAt?: string;
            recalled?: boolean;
            edited?: boolean;
        };
    }
    | {
        eventType: "MESSAGE_UPDATED";
        conversationId?: string;
        message: {
            messageId?: string;
            id?: string;
            conversationId: string;
            senderId: string;
            receiverId?: string | null;
            type?: string;
            content: string;
            fileUrl?: string | null;
            fileName?: string | null;
            reactions?: string[];
            deletedForUsers?: string[];
            deliveredTo?: string[];
            seenBy?: string[];
            createdAt: string;
            updatedAt?: string;
            recalled?: boolean;
            edited?: boolean;
        };
    }
    | {
        eventType: "MESSAGE_REACTION_UPDATED";
        conversationId?: string;
        message: {
            messageId?: string;
            id?: string;
            conversationId: string;
            senderId: string;
            receiverId?: string | null;
            type?: string;
            content: string;
            fileUrl?: string | null;
            fileName?: string | null;
            reactions?: string[];
            deletedForUsers?: string[];
            deliveredTo?: string[];
            seenBy?: string[];
            createdAt: string;
            updatedAt?: string;
            recalled?: boolean;
            edited?: boolean;
        };
    };