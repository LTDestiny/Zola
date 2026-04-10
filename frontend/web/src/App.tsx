import { useMemo } from "react";

type ServiceStatus = {
  name: string;
  port: number;
  healthPath: string;
};

const services: ServiceStatus[] = [
  { name: "api-gateway", port: 8080, healthPath: "/api/v1/system/health" },
  { name: "auth-service", port: 8081, healthPath: "/api/v1/system/health" },
  { name: "user-service", port: 8082, healthPath: "/api/v1/system/health" },
  { name: "chat-service", port: 8083, healthPath: "/api/v1/system/health" },
  { name: "file-service", port: 8084, healthPath: "/api/v1/system/health" },
  { name: "ai-service", port: 8085, healthPath: "/api/v1/system/health" },
  {
    name: "notification-service",
    port: 8086,
    healthPath: "/api/v1/system/health",
  },
  { name: "call-service", port: 8087, healthPath: "/api/v1/system/health" },
  { name: "admin-service", port: 8088, healthPath: "/api/v1/system/health" },
];

export function App() {
  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_URL ?? "http://localhost:8080",
    [],
  );

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 24,
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      <h1>Zola System Bootstrap</h1>
      <p>Base URL: {apiUrl}</p>
      <p>
        Scaffold created from project Context.md. Use this web shell as the
        starting point for auth/chat pages.
      </p>
      <h2>Microservices</h2>
      <ul>
        {services.map((svc) => (
          <li key={svc.name}>
            {svc.name} - localhost:{svc.port}
            {svc.healthPath}
          </li>
        ))}
      </ul>
    </main>
  );
}
