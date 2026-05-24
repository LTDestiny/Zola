package com.zola.chat.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalGatewayAuthFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Internal-Gateway-Secret";

    private final String gatewaySecret;

    public InternalGatewayAuthFilter(
        @Value("${app.internal.gateway-secret:internal-dev-secret}") String gatewaySecret
    ) {
        this.gatewaySecret = gatewaySecret == null ? "" : gatewaySecret;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
            || path.startsWith("/api/v1/system/")
            || path.startsWith("/actuator/")
            || path.startsWith("/ws");
    }

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String providedSecret = request.getHeader(HEADER_NAME);
        if (gatewaySecret.isBlank() || !constantTimeEquals(gatewaySecret, providedSecret)) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Missing or invalid internal gateway secret");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (actual == null) {
            actual = "";
        }
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            actual.getBytes(StandardCharsets.UTF_8)
        );
    }
}
