# Zola Mobile (React Native + Expo)

Mobile chat 1-1 app for LAN backend.

## Features

- Login / Register with backend auth API
- Secure token storage (SecureStore + AsyncStorage fallback)
- Chat list with unread badge, pin marker, search
- Chat detail with message history, pagination, typing indicator
- Message actions (copy, recall, delete for me, reactions)
- Attachments: image/video, file upload
- Realtime STOMP socket events:
  - message:new
  - message:seen
  - message:typing
  - message:recall
  - presence:update
  - conversation:update
- Unread fix logic:
  - Not opening chat: increment unread + move conversation to top
  - Opening active chat: mark seen immediately, no unread increment
  - Entering chat: PATCH /conversations/:id/read and clear unread

## LAN Config

Edit [app.json](app.json) -> expo.extra:

- apiBaseUrl: http://192.168.1.10:8080
- socketUrl: ws://192.168.1.10:8083/ws

## Run

```bash
npm install
npm run start
```

Android local build:

```bash
npm run android
```

Release APK (local):

```bash
npx expo prebuild
cd android
gradlew assembleRelease
```

APK output:

- android/app/build/outputs/apk/release/app-release.apk
