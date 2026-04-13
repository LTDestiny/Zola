package com.zola.chat.infrastructure.cache;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class RedisOnlineUserChecker {

    private static final String ONLINE_KEY_PREFIX = "chat:online:session-count:";
    private static final Duration TTL = Duration.ofHours(12);

    private final StringRedisTemplate stringRedisTemplate;

    public RedisOnlineUserChecker(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void markOnline(String userId) {
        Long value = stringRedisTemplate.opsForValue().increment(ONLINE_KEY_PREFIX + userId);
        if (value != null && value > 0) {
            stringRedisTemplate.expire(ONLINE_KEY_PREFIX + userId, TTL);
        }
    }

    public void markOffline(String userId) {
        String key = ONLINE_KEY_PREFIX + userId;
        Long value = stringRedisTemplate.opsForValue().decrement(key);
        if (value == null || value <= 0) {
            stringRedisTemplate.delete(key);
        }
    }

    public boolean isOnline(String userId) {
        String raw = stringRedisTemplate.opsForValue().get(ONLINE_KEY_PREFIX + userId);
        if (raw == null) {
            return false;
        }
        try {
            return Long.parseLong(raw) > 0;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}
