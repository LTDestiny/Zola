# Routing Documentation - Zola Frontend Web

## Overview
Project là **Expo React Native WebView** nhúng **React Router v6 web app**. 
- **Native Layer**: Expo Router quản lý native navigation (app/(tabs)/)
- **Web Layer**: React Router v6 quản lý web routing bên trong WebView
- **URL Sync**: WebView track URL changes để native biết web navigation thay đổi

---

## Routes Configuration

### Entry Point
- **File**: `src/App.tsx`
- **Framework**: React Router v6 (BrowserRouter)
- **Context Providers**: 
  - `LanguageProvider` - Cung cấp i18n support (tiếng Việt/English)

---

## Route List

| Path | Component | Protected? | Mô Tả |
|------|-----------|-----------|-------|
| `/` | `HomePage` | ❌ Công khai | Trang chủ |
| `/login` | `LoginPage` | ❌ Công khai | Đăng nhập bằng email/password |
| `/register` | `RegisterPage` | ❌ Công khai | Đăng ký tài khoản mới |
| `/forgot-password` | `ForgotPasswordPage` | ❌ Công khai | Lấy lại mật khẩu |
| `/policy` | `PolicyPage` | ❌ Công khai | Chính sách sử dụng |
| `/chat` | `ChatPage` | ✅ Bảo vệ | Trang chat chính (yêu cầu đăng nhập) |
| `*` | `Navigate to /` | — | Route không tồn tại → Redirect về trang chủ |

---

## Protected Routes (Authentication)

### RequireAuth Component
- **File**: `src/auth/RequireAuth.tsx`
- **Chức năng**: Wrapper component bảo vệ routes cần xác thực
- **Hoạt động**:
  - Kiểm tra token có lệ hợp bằng `isAuthenticated()`
  - Nếu chưa đăng nhập → Redirect to `/login` + lưu location từ `state.from`
  - Nếu đã đăng nhập → Render component con

**Ví dụ sử dụng**:
```tsx
<Route
  path="/chat"
  element={
    <RequireAuth>
      <ChatPage />
    </RequireAuth>
  }
/>
```

### Authentication Token
- **File**: `src/auth/token.ts`
- **Hàm kiểm tra**: `isAuthenticated()`
- **Lưu trữ**: localStorage
  - `ACCESS_TOKEN_KEY` - Access token
  - `ACCESS_EXPIRES_AT_KEY` - Thời gian hết hạn
  - `REFRESH_TOKEN_KEY` - Refresh token

---

## Page Components Location
```
src/pages/
├── chat.tsx                  (Legacy or utility file)
├── ChatPage.tsx             (Chat interface - protected)
├── ForgotPasswordPage.tsx   (Password recovery)
├── HomePage.tsx             (Home page)
├── LoginPage.tsx            (Login form)
├── PolicyPage.tsx           (Terms of service)
├── RegisterPage.tsx         (Registration form)
└── components/              (Sub-components for pages)
    ├── AddFriendModal.tsx
    ├── ChatHeader.tsx
    ├── ChatList.tsx
    ├── ChatMessage.tsx
    ├── ConversationList.tsx
    ├── ForwardMessageModal.tsx
    ├── MessageActions.tsx
    ├── MessageBubble.tsx
    ├── MessageRenderer.tsx
    ├── MiniNav.tsx
    └── Sidebar.tsx
```

---

## Native Layer - Expo Router

### Screens
- **File**: `app/(tabs)/_layout.tsx`
- **Active Screens**:
  - `index` - Home (WebView with React Router web app)
  - `explore` - Explore tab

### Tab Navigation
```tsx
<Tabs>
  <Tabs.Screen
    name="index"
    options={{ title: 'Home', tabBarIcon: ... }}
  />
  <Tabs.Screen
    name="explore"
    options={{ title: 'Explore', tabBarIcon: ... }}
  />
</Tabs>
```

### Communication Web ↔ Native
- **Web → Native**: postMessage via WebView
- **Native → Web**: executeJavaScript via WebView ref
- Currently: Basic back button handling via `canGoBack` state

---

### LanguageProvider
- **File**: `src/i18n/language.tsx`
- **Hỗ trợ**: Tiếng Việt (vi) và English (en)
- **Provider**: Bao bọc toàn bộ App
- **Hook**: `useLanguage()` - Lấy i18n context

**Hook Usage**:
```tsx
const { t, language, setLanguage } = useLanguage();
```

---

## Navigation Flow

### Public User Journey
```
/ (Home)
  ↓
/register (Sign up)  OR  /login (Sign in)
  ↓
/forgot-password (if needed)
  ↓
/chat (After successful login)
```

### Authentication Flow
1. User truy cập `/chat` → `RequireAuth` kiểm tra
2. Nếu chưa login → Redirect to `/login` (location lưu ở state)
3. User submit login form → `loginWithEmailPassword()` API call
4. Backend trả access token + refresh token
5. Frontend lưu tokens vào localStorage
6. App redirect to `/chat` hoặc previous location

### Logout Flow
1. Token hết hạn (401 response)
2. Interceptor ở `httpClient.ts` tự động:
   - Clear tokens
   - Lưu logout message vào sessionStorage
   - Redirect to `/login`

---

## API Endpoints Mapping

| Component | Endpoint | Method |
|-----------|----------|--------|
| LoginPage | `/api/v1/auth/login` | POST |
| RegisterPage | `/api/v1/auth/register` | POST |
| RegisterPage | `/api/v1/auth/register/verify-otp` | POST |
| ForgotPasswordPage | `/api/v1/auth/forgot-password` | POST |
| ForgotPasswordPage | `/api/v1/auth/verify-otp` | POST |
| ForgotPasswordPage | `/api/v1/auth/reset-password` | POST |
| ChatPage | `/api/v1/users/{userId}/summary` | GET |
| ChatPage | WebSocket: `/ws` (STOMP) | WS |

---

## Configuration

### WebView Setup (Mobile Native)
- **File**: `app/(tabs)/index.tsx`
- **Base URL**: `http://192.168.10.39:5173` (dev server)
- **Critical Props**:
  - `javaScriptEnabled` - Enable JavaScript in web
  - `domStorageEnabled` - Enable localStorage/sessionStorage
  - `databaseEnabled` - Enable IndexedDB/Web SQL
  - `onNavigationStateChange` - Track URL changes when web navigates
  - `injectedJavaScript` - Inject code to monitor `history.pushState/replaceState`

**WebView Instance**:
```tsx
<WebView
  ref={webViewRef}
  source={{ uri: BASE_URL }}
  javaScriptEnabled
  domStorageEnabled
  databaseEnabled
  onNavigationStateChange={handleNavigationStateChange}
  injectedJavaScript={`
    // Monitor React Router history API
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      console.log('URL changed:', window.location.href);
    };
  `}
/>
```

### Dev Server
- **Port**: 5173
- **Host**: 0.0.0.0 (lắng nghe toàn bộ network interface)
- **API Base URL**: Same-origin (dev proxy: `/api`)
- **WebSocket**: Same-origin (dev proxy: `/ws`)

### Production
- **API URL**: `import.meta.env.VITE_API_URL` (default: `http://192.168.10.39:8080`)
- **WebSocket**: `import.meta.env.VITE_WS_URL` (default: `ws://192.168.10.39:8083/ws`)

---

## Environment Variables

```bash
# Optional - override dev defaults
VITE_API_URL=http://your-backend:8080
VITE_WS_URL=ws://your-backend:8083/ws
```

If not set:
- **Dev mode**: Uses dev proxy (same-origin)
- **Production**: Hardcoded defaults above

---

## Key Features

✅ **Protected Routes** - Automatic token validation  
✅ **Auth Interceptor** - Auto token refresh + 401 handling  
✅ **i18n Support** - Vietnamese + English  
✅ **Same-origin Proxy** - Avoid CORS issues in dev  
✅ **Auto Logout** - On token expiry  
✅ **Real-time Chat** - WebSocket via STOMP (port 8083)  

---

## Troubleshooting

### WebView URL not changing on navigation?

**Problem**: Web chuyển trang nhưng URL trong WebView không thay đổi

**Causes**:
1. React Router không push history đúng cách
2. WebView props không được cấu hình đúng
3. Browser/WebView không theo dõi history changes

**Solutions**:

1. **Kiểm tra React Router v6 setup** - Đảm bảo BrowserRouter được configure:
```tsx
// src/App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/chat" element={<ChatPage />} />
    {/* Các routes khác */}
  </Routes>
</BrowserRouter>
```

2. **Kiểm tra navigation links** - Sử dụng `<Link>` hoặc `navigate()` từ React Router:
```tsx
// ✅ Đúng
import { Link, useNavigate } from 'react-router-dom';

<Link to="/chat">Go to Chat</Link>

const navigate = useNavigate();
navigate('/chat');

// ❌ Sai
<a href="/chat">Go to Chat</a>  // Không sử dụng anchor tags thường
window.location.href = '/chat'; // Reload toàn bộ trang
```

3. **WebView Props cần thiết**:
   - ✅ `javaScriptEnabled={true}` - Bắt buộc để React Router hoạt động
   - ✅ `domStorageEnabled={true}` - Cho localStorage (auth tokens)
   - ✅ `injectedJavaScript` - Monitor history API
   - ✅ `onNavigationStateChange` - Track URL changes

4. **URL Base** - Không hardcode path `/chat`, load base URL:
```tsx
// ❌ Sai
<WebView source={{ uri: 'http://192.168.10.39:5173/chat' }} />

// ✅ Đúng
const BASE_URL = 'http://192.168.10.39:5173';
<WebView source={{ uri: BASE_URL }} />
```

5. **Debug**: Kiểm tra console logs:
   - Mở DevTools web: `http://192.168.10.39:5173`
   - Xem Network tab để track request
   - Check console cho JavaScript errors

### Route not working?
- Check path spelling (case-sensitive)
- Verify `<RequireAuth>` wrapping for protected routes
- Clear localStorage and refresh

### Token issues?
- Check `localStorage` for token presence
- Verify `isAuthenticated()` logic
- Check interceptor response handler for 401 cases

### i18n not updating?
- Verify `useLanguage()` hook usage
- Check `LanguageProvider` wraps App
- Ensure translations exist in i18n config
