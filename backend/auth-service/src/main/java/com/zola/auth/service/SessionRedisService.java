package com.zola.auth.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
public class SessionRedisService {

    private final StringRedisTemplate redisTemplate;

    public SessionRedisService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void activateSession(UUID userId, UUID sessionId, Duration ttl) {
        redisTemplate.opsForValue().set(sessionKey(userId, sessionId), "1", ttl);
    }

    public void revokeSession(UUID userId, UUID sessionId) {
        redisTemplate.delete(sessionKey(userId, sessionId));
    }

    public boolean isSessionActive(UUID userId, UUID sessionId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(sessionKey(userId, sessionId)));
    }

    public String sessionKey(UUID userId, UUID sessionId) {
        return "session:" + userId + ":" + sessionId;
    }
}
