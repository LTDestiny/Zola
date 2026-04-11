package com.zola.gateway.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class GatewayJwtFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PREFIXES = List.of(
        "/api/v1/system/",
        "/api/v1/auth/login/request-otp",
        "/api/v1/auth/login/verify-otp",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/verify-otp"
    );

    private final GatewayJwtService gatewayJwtService;
    private final StringRedisTemplate redisTemplate;

    public GatewayJwtFilter(GatewayJwtService gatewayJwtService, StringRedisTemplate redisTemplate) {
        this.gatewayJwtService = gatewayJwtService;
        this.redisTemplate = redisTemplate;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Missing bearer token");
            return;
        }

        try {
            Claims claims = gatewayJwtService.parse(authHeader.substring(7));
            String userId = claims.get("userId", String.class);
            String sessionId = claims.get("sessionId", String.class);
            if (userId == null || sessionId == null) {
                response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid token payload");
                return;
            }

            String sessionKey = "session:" + userId + ":" + sessionId;
            if (!Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey))) {
                response.sendError(HttpStatus.UNAUTHORIZED.value(), "Session revoked or expired");
                return;
            }

            request.setAttribute("X_USER_ID", userId);
            request.setAttribute("X_SESSION_ID", sessionId);
        } catch (Exception ex) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid token");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
