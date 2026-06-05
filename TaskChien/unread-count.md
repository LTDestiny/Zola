# Chức năng Đếm số tin nhắn chưa đọc (Unread Count)

## 1. Mục đích nghiệp vụ
- **Chức năng:** Hiển thị số lượng tin nhắn chưa đọc (badge đỏ) trên từng phòng chat trong danh sách hội thoại, và tổng hợp lại thành 1 con số nhỏ hiển thị trên icon ứng dụng (App Icon Badge) hoặc thanh tab.
- **Trường hợp sử dụng:** Thông báo cho người dùng biết họ đã bỏ lỡ bao nhiêu tin nhắn mới trong lúc không mở màn hình chat đó.

## 2. Luồng hoạt động
**Luồng Tăng số đếm (Khi có tin nhắn mới):**
1. **User B:** Gửi tin nhắn cho User A.
2. **Chat Service:** Lưu tin nhắn vào MongoDB. Đồng thời gọi `conversation.updateUnreadCount(...)` để tác động vào PostgreSQL.
3. **Database (Postgres):**
   - Nếu là chat 1-1: Cộng 1 vào cột `user1_unread_count` (nếu người nhận là user1) hoặc `user2_unread_count`.
   - Nếu là Group chat: Cộng 1 vào bảng `conversation_members` tương ứng với các user khác.
4. **WebSocket:** Bắn Event. Frontend của A (nếu đang ở màn List) nhận event và tự cộng +1 lên badge đỏ của phòng chat đó.

**Luồng Reset số đếm (Khi user A đọc tin):**
1. **User A:** Bấm vào phòng chat, Frontend kích hoạt API "Đánh dấu đã đọc" (Read Receipt).
2. **Chat Service:** Nhận lệnh Read Receipt. Cập nhật Mongo `seenBy`. Đồng thời gọi Postgres reset số đếm.
3. **Database (Postgres):** Gán thẳng `user_unread_count = 0`.
4. **WebSocket:** Bắn Sync event cho các thiết bị khác của A để tụt chấm đỏ xuống. (Device Sync).

## 3. API liên quan
Không có API dành riêng độc lập cho việc "cộng số". Nó chạy ngầm bên trong API Send Message.
Có API để Reset số đếm (Chính là API Read Receipt):
- **PATCH /api/v1/conversations/{conversationId}/read** (Gán tất cả thành đã đọc)
Và có API lấy Tổng đếm toàn cục (Thường được xây dựng riêng):
- **GET /api/v1/users/me/badges** (Lấy tổng số chấm đỏ ngoài màn hình chính).

## 4. Database
- **PostgreSQL:**
  - Bảng `conversation`: Thêm cột `user1_unread_count` (int) và `user2_unread_count` (int) cho chat 1-1 (Cách tối ưu cực nhanh so với bảng phụ).
  - Bảng `conversation_members`: Thêm cột `unread_count` (int) cho group chat (Bởi nhóm có N người).
- Việc lưu bộ đếm bằng cột số nguyên (integer) dưới Database quan hệ là cách làm dễ nhất cho hệ thống vừa và nhỏ.

## 5. Redis
- **Rất quan trọng cho hệ thống LỚN.** Ở hệ thống khổng lồ (như Zalo 70 triệu user), Postgres bị nghẽn (Lock) nếu 1 nhóm chat 1000 người có 1 người gõ phím, phải UPDATE `unread_count` của 999 người còn lại. 
- Do đó, họ KHÔNG dùng Postgres để cộng. Họ dùng **Redis Counters (Hash/String `INCR`)**. Lệnh INCR trên Redis là Atomic và siêu nhanh. Chỉ khi nào reset = 0 mới đồng bộ Write-back về Postgres. Zola có thể tùy biến kiến trúc này.

## 6. WebSocket
- Chơi vai trò báo hiệu realtime. Payload của tin nhắn mới gửi xuống luôn bao hàm biến cờ để UI biết mà tự cộng số đếm lên 1.

## 7. Security
- Không cho phép User tự ý gán số `unread_count = 9999` bằng API REST bậy bạ. Việc tính toán bắt buộc phải do Backend thực hiện nội bộ (Server-side increment).
- Trừ API "Mark as unread" (Đánh dấu chưa đọc) thì user có quyền gọi (nhưng gán = 1).

## 8. Edge Cases (Tình huống đặc biệt)
- **Tin nhắn hệ thống / Tin bị thu hồi:** Nếu tin vừa gửi (đã +1) sau đó bị thu hồi. Trạng thái `unread_count` có bị trừ 1 không? Tùy UX. Zalo không trừ. Khi bấm vào phòng thì số nó tự reset thành 0 luôn.
- **Mở sẵn phòng chat:** Nếu User A đang mở trực tiếp khung chat và nhìn chằm chằm. Lúc tin nhắn tới, số đếm có bị +1 không? CÓ dưới DB (vì DB không biết ai đang mở màn hình). NHƯNG Frontend chặn lại, ngay khi nhận tin, Frontend gửi ngược lại 1 hàm Read Receipt đẩy số về 0 trong 1 mili-giây. Người dùng không bao giờ thấy chấm đỏ. (Hoặc Backend kiểm tra cờ Presence/Activity trước khi cộng).
- **Notification Badge ở App Icon iOS/Android:** Firebase Cloud Messaging (FCM) có param `badge`. Backend phải query tổng đếm từ DB và truyền vào biến `badge: 5` để gửi cho Apple APNs hiển thị số ngoài màn hình nền điện thoại.

## 9. Các câu hỏi vấn đáp giảng viên có thể hỏi
1. Việc cộng `unread_count = unread_count + 1` thực hiện ở Database bằng câu lệnh SQL nào để tránh Race Condition (mất số do ghi đè)?
2. Tại sao chat 1-1 lại thiết kế 2 cột `user1_unread` và `user2_unread` trực tiếp trong bảng `conversation` thay vì tạo bảng nối? Phân tích ưu nhược điểm.
3. Nếu nhóm có 10.000 người. Một tin nhắn gửi vào nhóm phải chạy vòng lặp cộng số đếm cho 9.999 người. Quá trình này có gây sập DB không? Cách khắc phục.
4. Lợi thế của việc dùng Redis INCR cho Unread Count so với Postgres?
5. Nếu Redis sập hoặc mất điện bị Flush, số đếm Unread Count lấy lại từ đâu?
6. Làm sao để Backend lấy tổng số tin nhắn chưa đọc của toàn bộ ứng dụng (Sum Badge) gửi cho Apple Push Notification một cách nhanh nhất?
7. Sự khác biệt giữa `unread_count` (số lượng tin) và `last_read_message_id` (ID tin đọc cuối)? Cách nào tốt hơn?
8. Tại sao có tính năng "Đánh dấu chưa đọc" nhưng số đếm chỉ hiện ra số 1 chứ không phải là con số trước lúc bấm đọc?
9. Nếu tắt thông báo (Mute) một phòng chat, số chưa đọc có tăng lên không?
10. Sẽ ra sao nếu hai user nhắn tin qua lại cực nhanh (mỗi người 5 tin/giây), DB có bị khóa (Deadlock) ở thao tác Update Count không?
11. Logic xử lý "Cộng dồn" (Throttling/Debouncing DB write) ở Backend hoạt động thế nào để giảm tải I/O ổ cứng?
12. Có thể bỏ qua hoàn toàn bộ đếm Postgres và Count trực tiếp bằng hàm count() của MongoDB dựa trên trường `seenBy` được không? Tại sao?
13. Nếu Backend đếm sai (VD: 0 tin nhưng vẫn hiện số 1). Khắc phục thế nào?
14. Việc update `unread_count` nằm trong hay ngoài Transaction lưu tin nhắn (Save Message)? Vì sao?
15. Zola xử lý biến `badge` trong luồng gọi Firebase FCM như thế nào?

## 10. Câu trả lời mẫu
1. **Tránh ghi đè SQL:** Phải đẩy logic tính toán xuống DB Engine. Tuyệt đối không dùng code Java (Lấy `x` -> `x=x+1` -> Save). Phải dùng câu UPDATE RAW: `UPDATE conversation SET user1_unread = user1_unread + 1 WHERE id = ?`. Postgres sẽ dùng Row-level Lock đảm bảo chuẩn xác Atomic.
2. **Thiết kế 1-1:** Đưa 2 cột vào bảng `conversation` là nghệ thuật chuẩn hóa ngược (Denormalization). Chat 1-1 vĩnh viễn chỉ có 2 người. Việc này tiết kiệm 1 bảng nối (Join), query list phòng ra ngay số đếm siêu tốc. Nhược điểm: Phá vỡ tính chuẩn hóa 3NF, không tái sử dụng được cho Group.
3. **Nghẽn Group 10.000 người:** CÓ, sẽ sập RDBMS (Thực tượng Update Burst). Khắc phục: Với Group đông, HỦY tính năng `unread_count` chính xác. Chuyển sang mô hình: Chỉ cần biết phòng có tin mới hay không (Boolean cờ đỏ) hoặc đếm dựa trên `last_read_message_id`. Hoặc dùng luồng Async (Kafka) cộng dồn trong Redis dần dần.
4. **Redis INCR:** Redis chạy trên RAM 100%, thao tác O(1). Update biến trên RAM không gây tải cơ học lên đĩa cứng (IOPS) như Postgres. Chịu được lượng tương tác hàng triệu hit/giây.
5. **Khôi phục Redis:** Nếu dùng Redis làm cache Write-behind. Redis sập, mất số. Backend phải chạy Script phục hồi (Re-sync) bằng cách count() từ bảng `messages` MongoDB những tin lớn hơn `last_read_message_id` của Postgres. Rất tốn kém, nên Redis phải bật RDB/AOF.
6. **Tổng đếm cho Apple (Sum Badge):** Câu lệnh `SELECT SUM(unread_count) FROM conversation_members WHERE user_id = ?`. Vì có Index trên `user_id`, Postgres tính cái vèo. Nếu cần nhanh hơn, tạo 1 cột cache `total_unread` (Tổng) nằm ngay bảng User profile.
7. **Count vs Last Read ID:** Số Count chỉ là bộ đếm. `last_read_id` đánh dấu vị trí đọc (Watermark). Cách 2 xịn hơn vì nó cho phép Frontend tô vàng (Highlight) từ tin nhắn chưa đọc đầu tiên. Zola dùng cả hai để bổ trợ nhau.
8. **Đánh dấu chưa đọc:** Khi bấm "Mark as unread", hệ thống không thể biết (hoặc không lưu) bạn đã bỏ lỡ bao nhiêu tin ở quá khứ. Nó chỉ update cứng (Hardcode) `unread_count = 1` ở Postgres. App hiện lên chấm đỏ để bạn nhớ xử lý sau.
9. **Tắt thông báo (Mute):** CÓ TĂNG. Số đếm vẫn tăng (nhưng hiển thị màu xám thay vì đỏ, hoặc không push notification kêu Ting Ting). Số đếm là độc lập với việc Mute.
10. **Deadlock Postgres:** Có nguy cơ. Hai người Update qua lại bảng `conversation`, nếu không code cẩn thận thứ tự khóa, Deadlock có thể xảy ra. Spring Data JPA cung cấp `@Version` để Optimistic Lock (Ai ghi đè văng lỗi retry) hoặc cơ chế Retry tự động.
11. **Gom Write (Write-behind):** Tin nhắn gửi liên tục, Backend không đấm update DB liên tục. Backend cộng số vào 1 bộ đệm RAM (ConcurrentHashMap/Redis). Mỗi 5 giây có 1 Job Cron gom (Flush) update 1 lượt xuống Postgres. (Vd 5 tin nhắn = 1 lần Update +5).
12. **Không dùng Mongo Count:** CẤM. Mongo quét bảng để đếm (VD `$match: { seenBy: { $nin: [userId] } }`). Dù có Index, đếm cho 50 phòng cùng lúc mất hàng giây. Sẽ sập hệ thống. Buộc phải đếm riêng (Counters).
13. **Khắc phục Lệch số (Desync):** Đây là lỗi "Bóng ma" kinh điển của app chat. UX cho phép Frontend tự sửa lỗi: Nếu mở phòng chat ra màn hình (Reset = 0), gọi API báo Backend ép số đếm về 0. Đồng thời Frontend trừ cái chênh lệch đi ở Tổng đếm.
14. **Trong hay Ngoài Transaction:** Nằm Ở NGOÀI transaction lưu Mongo. Vì Mongo và Postgres là 2 DB khác nhau, không có Distributed Transaction (2PC). Lưu Mongo xong (Commit thành công), mới ném Event báo Async cho service khác update Postgres (Eventual Consistency). Postgres fail thì mất đếm, nhưng tin nhắn vẫn còn.
15. **FCM Badge:** Lúc gửi đẩy Push, Backend query nhanh ra cái Tổng `SELECT SUM...`, gán vào biến `badge: x` trong cục JSON Payload ném qua Firebase. Apple tự vẽ cái chấm đỏ icon ứng dụng ở màn hình Home điện thoại.
