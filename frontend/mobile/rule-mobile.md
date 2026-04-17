# Rule Mobile Chat 1-1 (LAN)

## Vai trò

Bạn là Senior Mobile Frontend Engineer + UI/UX Engineer + React Native/Flutter Expert.

## Mục tiêu

Chuyển toàn bộ chức năng Chat 1-1 từ Web hiện có sang Mobile App, sử dụng API backend nội bộ chạy bằng mạng LAN.

## Nguồn có sẵn

1. Giao diện Web hiện tại
2. Logic hoạt động Web hiện tại
3. API backend LAN
4. WebSocket/Socket.IO nội bộ

## Ràng buộc hệ thống

* Chỉ dùng mạng LAN nội bộ
* Không dùng Firebase
* Không dùng Supabase
* Không dùng cloud service
* Ưu tiên Android trước

## Cấu hình ví dụ

```env
API_BASE_URL=http://192.168.1.10:8080/api
SOCKET_URL=ws://192.168.1.10:8080
```

## Yêu cầu chuyển UI Web -> Mobile

* Sidebar chat list -> Mobile ChatListScreen
* Chat panel phải -> Fullscreen ChatDetailScreen
* Popup menu -> ActionSheet / BottomSheet
* Modal ảnh -> Native Modal
* Dropdown -> Native menu
* Layout web -> Bottom Tab + Stack Navigation

## Chức năng bắt buộc

### 1. Authentication

* LoginScreen
* RegisterScreen
* Validate form
* Lưu token AsyncStorage / Secure Storage
* Auto login lại

### 2. Chat List Screen

Hiển thị:

* Avatar
* Tên user
* Tin nhắn cuối
* Thời gian cuối
* Online/offline
* Badge đỏ unread
* Bold nếu chưa đọc
* Ghim chat
* Search conversation

Realtime:

* Có tin mới đẩy conversation lên đầu
* Tăng unreadCount
* Update tab badge tổng

### 3. Chat Detail Screen

Header:

* Avatar
* Tên user
* Online / typing
* Call icon
* Menu

Tin nhắn:

* Text
* Emoji
* Sticker
* Image
* Video
* File
* Audio

Bubble:

* Mình bên phải
* Người kia bên trái

### 4. Input Chat

* Text input
* Emoji picker
* Camera
* Chọn ảnh
* Gửi file
* Ghi âm
* Send button

### 5. Hành động tin nhắn

Long press:

* Copy
* Reply
* Recall
* Delete for me
* Forward
* Reaction 👍❤️😂😮😢

### 6. Realtime Socket LAN

Events:

```ts
message:new
message:seen
message:typing
message:recall
presence:update
conversation:update
```

## Fix lỗi unread quan trọng

### Nếu user KHÔNG mở chat:

```ts
conversation.unreadCount += 1
moveConversationToTop()
updateTotalUnread()
rerenderUI()
```

### Nếu user đang mở chat đó:

```ts
markSeenImmediately()
noUnreadIncrement()
```

### Khi user vào chat:

```ts
PATCH /conversations/:id/read
conversation.unreadCount = 0
updateTotalUnread()
```

## Performance

* FlatList inverted
* Pagination
* Lazy load image
* Memo components
* Debounce search
* Socket reconnect
* Retry failed send

## Cấu trúc thư mục

```bash
src/
 modules/chat/
   screens/
   components/
   hooks/
   store/
   api/
   socket/
   utils/
```

## Screens bắt buộc

* LoginScreen
* RegisterScreen
* ChatListScreen
* ChatDetailScreen
* ProfileScreen

## Components bắt buộc

* ChatItem
* MessageBubble
* MessageInput
* UnreadBadge
* TypingIndicator

## Hooks

* useSocket()
* useMessages()
* useUnread()

## State Management

* Redux Toolkit hoặc Zustand

## Yêu cầu UI

Thiết kế giống:

* Zola Mobile
* Messenger Mobile
* Telegram Mobile

## Output mong muốn

1. Full source mobile frontend
2. Reuse logic web hiện có
3. Chạy bằng IP LAN
4. Fix unread hoàn chỉnh
5. UI đẹp, mượt
6. Build APK được ngay

## Coding Standard

* Clean code
* Reusable components
* Typed đầy đủ
* Production-ready
* Dễ mở rộng
