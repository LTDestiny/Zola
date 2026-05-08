# Zola Mobile WebView (Android)

Android WebView native cho `../web`. App build web vào `android_asset` và phục vụ qua origin secure `https://appassets.androidplatform.net`, nhờ đó `navigator.mediaDevices.getUserMedia`/WebRTC có thể xin quyền camera và microphone trên Android. API/WebSocket trỏ về backend trong LAN qua biến môi trường lúc build web.

## Cấu hình LAN

Tạo `../web/.env.local` theo IP backend trong LAN, ví dụ:

```env
VITE_API_URL=http://10.18.76.36:18080
VITE_WS_URL=ws://10.18.76.36:8083/ws
VITE_CALL_DEBUG=true
```

Có thể copy mẫu:

```bash
cp .env.lan.example ../web/.env.local
```

## Build APK debug

```bash
npm run build:android
```

APK debug nằm tại:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Cài vào máy Android đang bật USB debugging:

```bash
npm run install:android
```

## Lưu ý để video call chạy trong LAN

- Điện thoại Android và backend phải cùng LAN, truy cập được IP trong `VITE_API_URL` và `VITE_WS_URL`.
- App đã khai báo quyền `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `INTERNET`.
- App cho phép cleartext traffic để gọi HTTP/WebSocket LAN.
- WebView dùng secure app-assets origin nên không bị lỗi browser chặn camera/micro khi truy cập HTTP IP trực tiếp.
- Nếu WebRTC hai máy không thấy nhau trong LAN khác subnet/VLAN, cần cấu hình STUN/TURN qua `VITE_WEBRTC_ICE_SERVERS` ở `../web/.env.local`.
