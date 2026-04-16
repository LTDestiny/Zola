import { ChatMessageRow, type ChatMessage, type ChatMessageProps } from "./ChatMessage";

type MessageRendererProps = ChatMessageProps;

export type { ChatMessage };

export function MessageRenderer(props: MessageRendererProps) {
    return <ChatMessageRow {...props} />;
}
