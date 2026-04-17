# Online/Offline Presence Feature

## Tổng quan

Chức năng hiển thị trạng thái online/offline cho hệ thống chat 1-1, đồng bộ giữa Web (ReactJS) và Mobile (React Native).

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────┬───────────────────────────────┤
│           Web (ReactJS)         │     Mobile (React Native)     │
│  ┌─────────────────────────────┐│  ┌─────────────────────────┐  │
│  │ usePresence hook            ││  │ usePresence hook        │  │
│  │ PresenceBadge component     ││  │ PresenceBadge component │  │
│  │ ChatHeader component        ││  │ ChatHeaderPresence      │  │
│  │ ChatList (memoized)         ││  │ ChatItem (memoized)     │  │
│  └─────────────────────────────┘│  └─────────────────────────┘  │
└─────────────────────────────────┴───────────────────────────────┘
                              │
                    WebSocket (STOMP)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Spring Boot)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ PresenceManager - Multi-device presence with delayed offline ││
│  │ PresenceEventPublisher - WebSocket event broadcasting       ││
│  │ PresenceController - REST API endpoints                     ││
│  │ SocketAuthChannelInterceptor - Connect/Disconnect handling  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Redis                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ presence:user:{userId}:sessions - Session count             ││
│  │ presence:user:{userId}:online   - Online status             ││
│  │ presence:user:{userId}:lastSeen - Last seen timestamp       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Backend

### 1. PresenceManager (`/chat-service/src/main/java/com/zola/chat/presence/PresenceManager.java`)

Quản lý trạng thái presence với các tính năng:

- **Multi-device support**: Đếm số session của user, chỉ offline khi tất cả session disconnect
- **Delayed offline**: 15 giây grace period trước khi đánh dấu offline (tránh chập chờn mạng)
- **Last seen tracking**: Lưu timestamp hoạt động cuối cùng
- **Batch operations**: Hỗ trợ lấy presence nhiều user cùng lúc (tối ưu cho chat list)

```java
// Key methods
PresenceState connect(String userId, String sessionId);
void disconnect(String userId, String sessionId);
void forceOffline(String userId);
PresenceState getPresence(String userId);
Map<String, PresenceState> getPresenceBatch(List<String> userIds);
```

### 2. PresenceEventPublisher (`/chat-service/src/main/java/com/zola/chat/presence/PresenceEventPublisher.java`)

Broadcast presence events qua WebSocket:

```
/topic/presence                - Global presence updates (broadcast)
/topic/presence/{userId}       - Specific user presence updates
/user/{userId}/queue/presence  - Private presence updates
```

Event payload:
```json
{
  "eventType": "USER_ONLINE" | "USER_OFFLINE",
  "userId": "...",
  "online": true,
  "sessionCount": 2,
  "lastSeenAt": "2024-01-15T10:30:00Z"
}
```

### 3. PresenceController (`/chat-service/src/main/java/com/zola/chat/presence/PresenceController.java`)

REST API endpoints:

```
GET  /api/presence/{userId}     - Get single user presence
POST /api/presence/batch        - Get batch user presence
```

Request (batch):
```json
{
  "userIds": ["user1", "user2", "user3"]
}
```

Response:
```json
{
  "success": true,
  "data": [
    {"userId": "user1", "online": true, "sessionCount": 1, "lastSeenAt": null},
    {"userId": "user2", "online": false, "sessionCount": 0, "lastSeenAt": "2024-01-15T10:30:00Z"}
  ]
}
```

## Frontend

### Time Formatter Utilities

File: `timeFormatter.ts` (shared logic for both Web and Mobile)

```typescript
// Message timestamp formatting
formatMessageTime(timestamp, 'vi')
// "vừa xong" | "5p" | "3 giờ" | "Hôm qua" | "10/01" | "15/06/2023"

// Last seen formatting
formatLastSeen(timestamp, 'vi')
// "Hoạt động vừa xong" | "Hoạt động 5 phút trước" | "Hoạt động 3 giờ trước" | "Hoạt động ngày 10/01"

// Presence label
getPresenceLabel(online, lastSeenAt, 'vi')
// "Đang hoạt động" | "Hoạt động X phút trước"
```

### usePresence Hook

```typescript
const {
  presenceMap,        // Map<userId, PresenceState>
  isOnline,           // (userId) => boolean
  getLabel,           // (userId) => string
  getPresence,        // (userId) => PresenceState | null
  refreshPresence,    // () => Promise<void>
  updateFromRealtime, // (event) => void
  loading,            // boolean
  tick,               // number (for re-rendering time-based labels)
} = usePresence({
  userIds: ['user1', 'user2'],
  refreshInterval: 60000,  // Auto-refresh every minute
  debounceMs: 300,         // Debounce batch requests
  language: 'vi',          // Display language
});
```

### Web Components

#### PresenceBadge
```tsx
<PresenceBadge 
  online={true} 
  size="md"        // 'sm' | 'md' | 'lg'
  bordered={true}  // White border for overlaying on avatars
  position="bottom-right"  // Position when used as overlay
/>
```

#### PresenceStatus
```tsx
<PresenceStatus
  online={false}
  lastSeenAt="2024-01-15T10:30:00Z"
  language="vi"
  showBadge={true}
  badgeSize="sm"
/>
// Output: ● Hoạt động 30 phút trước
```

#### ChatHeader
```tsx
<ChatHeader
  name="John Doe"
  avatar="JD"
  isOnline={true}
  lastSeenAt="..."
  isTyping={false}
  language="vi"
/>
```

### Mobile Components

#### PresenceBadge (React Native)
```tsx
<PresenceBadge 
  online={true} 
  size="md"      // 8px | 10px | 12px
  bordered={true}
/>
```

#### ChatHeaderPresence
```tsx
<ChatHeaderPresence
  name="John Doe"
  initials="JD"
  avatarUrl="https://..."
  online={true}
  lastSeenAt="..."
  isTyping={false}
  language="vi"
/>
```

## UI Specifications

### Badge Colors
- **Online**: `#22c55e` (green-500)
- **Offline**: `#9ca3af` (gray-400)

### Badge Sizes
| Size | Mobile | Web |
|------|--------|-----|
| sm   | 8px    | 8px |
| md   | 10px   | 10px |
| lg   | 12px   | 12px |

### Border
- 2px white border when overlaying on avatars

## Performance Optimizations

1. **Memoized Components**: ChatItem, ChatList items are wrapped with `memo()` to prevent re-renders
2. **Debounced Batch Requests**: Multiple presence requests are debounced and batched
3. **Atomic Selectors**: Zustand selectors only subscribe to specific presence data
4. **Periodic Tick**: Time-based labels update every minute via a single interval

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| User mất mạng đột ngột | 15s delay trước khi offline |
| User mở 3 tab | Vẫn online khi còn ít nhất 1 tab |
| User login mobile + web cùng lúc | Session count tăng, vẫn online |
| Reconnect socket | Cancel pending offline task |
| App background (mobile) | Disconnect sau timeout |
| App foreground (mobile) | Reconnect ngay lập tức |

## Testing

### Unit Tests
```bash
# Web
cd frontend/web
npm test -- --grep "timeFormatter"
npm test -- --grep "usePresence"

# Mobile
cd frontend/mobile
npm test -- --grep "timeFormatter"
```

### Integration Test
File: `infrastructure/presence-web-mobile-test.mjs`

## File Structure

```
backend/chat-service/src/main/java/com/zola/chat/
├── presence/
│   ├── PresenceManager.java          # Core presence logic
│   ├── PresenceEventPublisher.java   # WebSocket events
│   └── PresenceController.java       # REST API
└── socket/
    └── SocketAuthChannelInterceptor.java  # Connect/Disconnect handling

frontend/web/src/
├── utils/
│   └── timeFormatter.ts              # Time formatting utilities
├── hooks/
│   └── usePresence.ts               # Presence hook
├── components/
│   └── PresenceBadge.tsx            # Badge component
└── pages/components/
    ├── ChatList.tsx                 # Updated with presence
    └── ChatHeader.tsx               # New component

frontend/mobile/src/modules/chat/
├── utils/
│   └── timeFormatter.ts             # Time formatting utilities
├── hooks/
│   └── usePresence.ts               # Presence hook
├── components/
│   ├── PresenceBadge.tsx            # Badge component
│   └── ChatItem.tsx                 # Updated with presence
└── screens/
    └── ChatDetailScreen.tsx         # Updated with presence header
```

## Configuration

### Backend (application.yml)
```yaml
presence:
  offline-delay-seconds: 15
  ttl-hours: 24
```

### Redis Keys
```
presence:user:{userId}:sessions  - Session count (integer)
presence:user:{userId}:online    - Online status ("true"/"false")
presence:user:{userId}:lastSeen  - Last seen (ISO timestamp)
```

## API Changes

### New Endpoints
- `GET /api/presence/{userId}` - Get single user presence
- `POST /api/presence/batch` - Get batch presence

### WebSocket Topics
- `/topic/presence` - Global presence broadcast
- `/topic/presence/{userId}` - User-specific presence

### Events
- `USER_ONLINE` - User went online
- `USER_OFFLINE` - User went offline
- `USER_LAST_SEEN_UPDATE` - Last seen timestamp updated
