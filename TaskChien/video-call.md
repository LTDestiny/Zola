# Chức năng Call Video

## 1. Mục đích nghiệp vụ
- **Chức năng:** Cho phép hai hoặc nhiều người dùng thực hiện cuộc gọi video trực tuyến trực tiếp trong thời gian thực.
- **Trường hợp sử dụng:** Người dùng muốn liên lạc trực quan qua camera và micrô.

## 2. Luồng hoạt động (WebRTC Signaling)
1. **User A (Người gọi):** Bấm nút Call video.
   - Frontend sinh ra một `callId` ngẫu nhiên.
   - Gửi tín hiệu `CALL_INVITE` lên WebSocket thông qua destination `/app/call.signal`.
2. **WebSocket Broker (Chat Service):**
   - Định tuyến tín hiệu `CALL_INVITE` tới User B (Người nhận) thông qua `/user/{userId}/queue/call`.
3. **User B (Người nhận):**
   - Nhận tín hiệu `CALL_INVITE` qua WebSocket.
   - Hiển thị màn hình cuộc gọi đến (đổ chuông).
   - Nếu B bấm chấp nhận (`CALL_ACCEPT`), Frontend của B gửi lại tín hiệu `CALL_ACCEPT` qua WebSocket.
4. **Thiết lập kết nối WebRTC (Peer-to-Peer):**
   - Sau khi chấp nhận, A và B trao đổi các thông tin cấu hình WebRTC:
     - **WEBRTC_OFFER:** A gửi đề xuất thông số media (audio/video codecs).
     - **WEBRTC_ANSWER:** B phản hồi thông số tương thích.
     - **WEBRTC_ICE:** Trao đổi các địa chỉ ICE candidate (địa chỉ IP/port thu thập từ STUN/TURN server) để tạo đường truyền trực tiếp giữa hai thiết bị.
5. **Kết nối trực tiếp:**
   - WebRTC connection thiết lập thành công. Luồng audio/video truyền trực tiếp giữa 2 máy (P2P) mà không đi qua máy chủ Zola.
6. **Kết thúc cuộc gọi:**
   - Một trong hai bên bấm cúp máy -> Gửi tín hiệu `CALL_END` qua WebSocket, giải phóng camera/mic và đóng WebRTC connection.

## 3. Tín hiệu WebSocket (Call Signal Types)
Các loại signal được xử lý tại `@MessageMapping({"/call.signal", "/signal/call"})` trong `ChatStompController.java`:
- `CALL_INVITE`: Bắt đầu cuộc gọi, đổ chuông đối phương.
- `CALL_ACCEPT`: Chấp nhận cuộc gọi.
- `CALL_REJECT`: Từ chối cuộc gọi.
- `CALL_JOINED`: Đã vào phòng gọi.
- `WEBRTC_OFFER`: Gửi SDP Offer.
- `WEBRTC_ANSWER`: Gửi SDP Answer.
- `WEBRTC_ICE`: Trao đổi ICE Candidates.
- `CALL_END`: Kết thúc cuộc gọi.

## 4. API liên quan
- **WebSocket STOMP Channel:**
  - Destination gửi: `/app/call.signal`
  - Subscription: `/user/queue/call`, `/topic/call/{conversationId}`, và `/topic/call` (Kênh fallback toàn cục).
  - Payload gửi nhận:
    ```json
    {
      "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "targetUserId": "userB_id",
      "callId": "call_123456",
      "mode": "video", // hoặc "voice"
      "signalType": "WEBRTC_OFFER",
      "payload": "{\"sdp\":\"...\"}"
    }
    ```
