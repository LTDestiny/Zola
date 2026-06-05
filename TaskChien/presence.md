# Chức năng Trạng thái Online/Offline (Presence)

## 1. Mục đích nghiệp vụ
- **Chức năng:** Theo dõi và hiển thị trạng thái đang truy cập (Online) hoặc lần cuối truy cập (Last seen) của người dùng. Dấu hiệu nhận biết thường là chấm tròn màu xanh lá cây trên avatar của bạn bè.
- **Trường hợp sử dụng:** Giúp người dùng biết đối phương có đang sử dụng ứng dụng hay không, từ đó kỳ vọng tốc độ phản hồi tin nhắn nhanh hay chậm.

## 2. Luồng hoạt động
1. **User:** Bật ứng dụng, hệ thống (SDK) ngầm thực hiện kết nối WebSocket tới máy chủ STOMP của Zola.
2. **WebSocket Handshake:**
   - Kết nối thành công, Client gửi lệnh `CONNECT`.
   - Lớp `PresenceEventListener` (hoặc `SocketAuthChannelInterceptor`) của Spring WebSocket lắng nghe sự kiện `SessionConnectedEvent`.
   - Trích xuất `userId` từ context xác thực.
3. **Cập nhật Redis (Online):**
   - Sự kiện đẩy vào `PresenceManager` / `RedisOnlineUserChecker`.
   - Hệ thống lưu một key vào Redis: `user:presence:{userId}` = (giá trị có thể là sessionId hoặc timestamp). Đặt thời hạn sống (TTL) cho key này là ngắn (VD: 5 phút).
   - Tăng biến đếm số thiết bị online của user đó (Bởi 1 user có thể vừa login PC vừa login Phone).
4. **Phát sự kiện trạng thái (Broadcast):**
   - Server lấy danh sách bạn bè của user vừa online, gửi qua WebSocket event `USER_ONLINE` để các bạn bè (nếu đang bật app) thấy chấm xanh bật lên.
5. **Heartbeat (Nhịp tim):**
   - Điện thoại của user cứ mỗi X giây (VD: 30s) sẽ gửi một gói tin PING rỗng. STOMP tự quản lý việc này. Khi nhận PING, Redis sẽ được gia hạn TTL lên lại 5 phút (Keep-alive).
6. **Disconnect (Offline):**
   - Khi tắt app (hoặc rớt mạng), socket ngắt, ném sự kiện `SessionDisconnectEvent`.
   - Hệ thống xóa key khỏi Redis, hoặc giảm biến đếm thiết bị. Nếu đếm = 0 -> Người dùng hoàn toàn Offline.
   - Lưu thời điểm (Timestamp) vào CSDL Postgres (trường `last_online_at` trong bảng User).
   - Bắn WebSocket `USER_OFFLINE` cho bạn bè.

## 3. API liên quan
**WebSocket / STOMP Lifecycle:**
- Dựa trên các Event nội bộ của Spring Boot (Không phải là API trực tiếp):
  - `SessionConnectEvent` (Bắt đầu handshake)
  - `SessionConnectedEvent` (Thành công nối STOMP)
  - `SessionDisconnectEvent` (Ngắt kết nối)
- Endpoint HTTP để Frontend query mồi lúc ban đầu: `GET /api/v1/users/presence?ids=A,B,C` (Trả về danh sách ai đang online).

## 4. Database
- **PostgreSQL: Bảng `users` (User Service)**
  - Trường `last_online_at` (Timestamp): Lưu thời điểm cuối cùng rớt mạng, dùng để tính toán chuỗi "Hoạt động 5 phút trước".
- **Không dùng MongoDB** cho tính năng này.

## 5. Redis (Cốt lõi)
- Redis là nơi lưu trữ CHÍNH để hệ thống xác định trạng thái Online (vì nó siêu nhanh và hỗ trợ tự động hết hạn - TTL).
- Key Format: `user:presence:{userId}` hoặc dùng Redis `Set`/`Hash` để chứa danh sách các Session ID đang mở của userId đó.
- Cấu trúc: `SADD online_sessions:{userId} {sessionId}`.

## 6. WebSocket
- Server phát ra Topic `/topic/presence` hoặc bắn qua Message Broker để các user khác nhận thông báo.
- Zola sử dụng Event Listeners nội bộ của STOMP Broker để bám vào vòng đời (Lifecycle) kết nối.

## 7. Security
- Không bao giờ cho phép Frontend gọi API HTTP để tự Set trạng thái Online. Nếu cho phép, hacker sẽ viết Bot spam HTTP khiến tài khoản Online 24/7 mà không cần mở socket. Trạng thái phải được Server tự ngầm định qua việc giữ kết nối TCP (WebSocket).
- Tính năng riêng tư: User có quyền vào Cài đặt -> Ẩn trạng thái hoạt động. Backend (Redis) vẫn ghi nhận họ online (để push tin nhắn) nhưng hàm Query trả về cho bạn bè sẽ ngắt (che) đi, trả về Offline.

## 8. Edge Cases (Tình huống đặc biệt)
- **Rớt mạng không có cờ báo (Ghost Session):** Nếu user đi vào vùng mất sóng, TCP connection bị đứt im lặng (half-open) mà không gửi gói `FIN`. Server SpringBoot không biết, không ném `SessionDisconnectEvent`. Lúc này, hệ thống sẽ ỷ lại vào cơ chế TTL của Redis (chờ 5 phút). Quá 5 phút không có Heartbeat (Ping), key Redis tự xóa, user bị đánh tụt thành Offline.
- **Login nhiều thiết bị (Multi-device):** A đang online trên Phone, bật thêm Laptop. Backend không được tính là 2 lần Online. Khi tắt Laptop, A vẫn còn Phone. Backend không được đánh Offline. Zola giải quyết bằng đếm Session (Set Size trong Redis).
- **Ứng dụng chạy nền (Background):** Khi user vuốt app iOS ra màn hình Home, OS cắt kết nối socket. Backend đánh Offline. Nhưng khi có tin nhắn, Apple đẩy Push notification (APNs). Trạng thái Offline không cản trở nhận Push Notification.

## 9. Các câu hỏi vấn đáp giảng viên có thể hỏi
1. Tại sao tính năng Online (Presence) lại dùng Redis làm nơi lưu trữ chính mà không phải là PostgreSQL?
2. Heartbeat (Nhịp tim) trong WebSocket là gì và nó giúp giải quyết bài toán gì cho tính năng Presence?
3. Nếu người dùng tắt mạng (rút cáp) đột ngột, làm sao Server biết để chuyển họ sang trạng thái Offline (tắt chấm xanh)?
4. Làm thế nào để giải quyết vấn đề đăng nhập nhiều thiết bị (Multi-device) với trạng thái Online? Làm sao để không bị "offline hụt" khi tắt 1 máy?
5. Việc lấy trạng thái Online của 1000 người bạn bè cùng lúc (khi mở màn hình danh bạ) được tối ưu như thế nào bằng Redis?
6. Logic "Ẩn trạng thái hoạt động" được cài đặt ở tầng nào? (Ghi vào Redis hay lúc Query lấy ra)?
7. Class `SessionDisconnectEvent` trong Spring WebSocket được kích hoạt khi nào?
8. Tại sao trạng thái "Hoạt động 5 phút trước" (Last seen) lại được lưu trong PostgreSQL thay vì Redis?
9. Nếu Redis sập, chấm xanh trên app bị ảnh hưởng thế nào? Việc nhắn tin có chết theo không?
10. Event `USER_ONLINE` được broadcast cho ai? Gửi cho tất cả mọi người trên hệ thống hay chỉ gửi cho bạn bè? Làm sao filter nhanh được list bạn bè?
11. Zola có cơ chế "Đang bận" (Do not disturb) hay "Vắng mặt" (Away) như Skype/Teams không? Triển khai như thế nào?
12. Có thể fake vị trí hoặc fake thời gian Online bằng Postman không?
13. Nếu Backend được scale lên thành 5 Server chạy song song (Microservices), việc quản lý Session và Presence có gì phức tạp?
14. Việc Redis hết hạn Key (TTL Expired) có sinh ra Event để báo cho Spring Boot bắn WebSocket Offline đi không?
15. Zola có sử dụng JWT TTL để quyết định trạng thái Online không?

## 10. Câu trả lời mẫu
1. **Lý do dùng Redis:** Trạng thái online thay đổi liên tục, việc bật/tắt (Read/Write) diễn ra hàng nghìn lần mỗi giây. Postgres ghi xuống đĩa sẽ quá tải IOPS. Redis chạy trên RAM và có tính năng tự hủy Key (TTL), cực kỳ hoàn hảo cho dữ liệu tuổi thọ ngắn như Presence.
2. **Heartbeat:** Là những gói tin Ping-Pong siêu nhỏ gửi qua lại giữa Client-Server định kỳ (vd 30s). Giúp giữ TCP Connection không bị FireWall ngắt, và báo cho Server biết thiết bị vẫn còn "sống" để gia hạn TTL trên Redis.
3. **Rút cáp đột ngột:** TCP đứt không kèn trống (Half-open connection). Server không nhận được `SessionDisconnectEvent` ngay lập tức. Nhưng vì không có Heartbeat gửi lên, Key trong Redis (TTL 5 phút) sẽ tự bốc hơi. Ai query sẽ thấy Offline. (Server cũng có cấu hình heartbeat timeout tự disconnect nội bộ).
4. **Multi-device:** Dùng Redis Data Structure `Set` thay vì `String`. Key là `user_sessions:{userId}`, value là tập hợp các `sessionId` (ví dụ Set `[sessA, sessB]`). Khi ngắt sessA, Redis tự xóa phần tử đó (`SREM`). Tiếp theo đếm `SCARD` (lấy kích thước). Nếu kích thước == 0, lúc đó mới update Postgres và broadcast sự kiện Offline.
5. **Tối ưu 1000 người:** Redis cung cấp lệnh `MGET` (Multi Get) hoặc Pipeline. Chỉ mất 1 vòng kết nối mạng tới Redis (Khoảng 2 mili-giây) để fetch được trạng thái Online của 1000 ID người dùng, siêu nhanh so với vòng lặp.
6. **Ẩn trạng thái (Privacy):** Nên xử lý ở lúc lấy ra (Query/Read-time). Redis vẫn ghi nhận user Online (để hệ thống còn điều hướng Notification và biết đường đẩy Push/Socket). Khi người khác Query API, Backend check rule Privacy, nếu `hideOnline == true`, Backend cố tình override kết quả thành `false` (Offline).
7. **SessionDisconnectEvent:** Kích hoạt khi Client chủ động gửi frame `DISCONNECT`, hoặc khi TCP socket bị đóng do lỗi mạng, hoặc do quá hạn Heartbeat timeout do Spring tự hủy.
8. **Last seen ở Postgres:** Vì "Last seen" là dữ liệu bền vững (Persistent Data), cần lưu lại vĩnh viễn (tuần này qua tuần khác) dù Server có sập hay khởi động lại. Redis chỉ dùng cho Live data.
9. **Redis sập:** Chấm xanh sẽ biến mất, tính năng bạn bè online không xài được. Tuy nhiên nhắn tin vẫn gửi nhận được bình thường vì dữ liệu tin nhắn lưu xuống MongoDB và WebSocket định tuyến trực tiếp dựa trên STOMP Broker local, không phụ thuộc Redis (trừ khi chạy cụm đa máy chủ dùng Redis Pub/Sub).
10. **Broadcast cho ai:** Bắn Event Online cho tất cả user trong Server thì sập mạng. Hệ thống dùng User Relationship Service (bảng Bạn Bè) để filter, lấy List Bạn Bè. Lọc ra những ai đang online mới bắt đầu ném Event vào `/user/{friendId}/queue/presence` để báo.
11. **Trạng thái Away:** Có thể thêm field `status` vào JSON lưu ở Redis thay vì chỉ rỗng. `{"sessionId": "123", "status": "AWAY"}`. Khi user treo máy không gõ chuột 10 phút, Frontend đẩy API chuyển status thành Away (Chấm vàng).
12. **Fake bằng Postman:** Hoàn toàn KHÔNG THỂ. Trạng thái được hook ngầm vào Event vật lý của Java Socket. Bạn không thể truyền HTTP API "tôi đang online" để qua mặt. Bạn phải duy trì 1 script giữ kết nối WebSocket (với JWT hợp lệ) liên tục thì mới tính là Online.
13. **Scale 5 Server:** Server 1 giữ kết nối của User A. Server 2 giữ kết nối User B. A không biết B online nếu 2 server không nói chuyện. Bắt buộc dùng Redis Pub/Sub. Khi A nối Server 1, Server 1 push status lên Redis. Server 2 subcribe Redis, báo cho B biết.
14. **Redis Key Expiry Event:** Redis hỗ trợ "Keyspace Notifications". Khi 1 key hết hạn (Expired), nó có thể bắn event Pub/Sub báo lại cho Spring Boot. Spring Boot lắng nghe event này, từ đó tự phát đi sự kiện `USER_OFFLINE`. Tuy nhiên tính năng này tốn CPU của Redis nên ít bật, hệ thống lớn dùng kiểu Query chủ động hơn.
15. **JWT TTL:** Không. JWT có thể có hạn 30 ngày (user không cần login lại). Nhưng nếu tắt app là ngắt Socket, bị đánh Offline ngay lập tức, không đợi 30 ngày. JWT chỉ là tờ vé xác thực, Socket mới là trạng thái hoạt động thực sự.
