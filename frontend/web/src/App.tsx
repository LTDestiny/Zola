import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { LanguageProvider } from "./i18n/language";
import { ChatPage } from "./pages/ChatPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { PolicyPage } from "./pages/PolicyPage";
import { RegisterPage } from "./pages/RegisterPage";

import { Toaster } from "react-hot-toast";

export function App() {
  const Router =
    typeof window !== "undefined" &&
    window.location.hostname === "appassets.androidplatform.net"
      ? HashRouter
      : BrowserRouter;

  return (
    <LanguageProvider>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: "toast-modern",
          style: {
            background: "#142841",
            color: "#fff",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            padding: "14px 18px",
            fontSize: "15px",
            fontWeight: 500,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          },
          success: {
            style: {
              background: "var(--color-zola-success)",
              color: "#fff",
              border: "none",
            },
            iconTheme: {
              primary: "#fff",
              secondary: "var(--color-zola-success)",
            },
          },
          error: {
            style: {
              background: "var(--color-zola-danger)",
              color: "#fff",
              border: "none",
            },
            iconTheme: {
              primary: "#fff",
              secondary: "var(--color-zola-danger)",
            },
          },
        }}
      />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route
            path="/chat"
            element={(
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}
