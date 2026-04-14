package com.zola.chat.infrastructure.cache;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class RedisOnlineUserChecker {

    private static final String ONLINE_KEY_PREFIX = "chat:online:session-count:";
    private static final String LAST_CHANGE_KEY_PREFIX = "chat:online:last-change:";
    private static final Duration TTL = Duration.ofHours(12);

    private final StringRedisTemplate stringRedisTemplate;

    public RedisOnlineUserChecker(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public Instant markOnline(String userId) {
        Long value = stringRedisTemplate.opsForValue().increment(ONLINE_KEY_PREFIX + userId);
        Instant changedAt = Instant.now();
        stringRedisTemplate.opsForValue().set(LAST_CHANGE_KEY_PREFIX + userId, changedAt.toString(), TTL);
        if (value != null && value > 0) {
            stringRedisTemplate.expire(ONLINE_KEY_PREFIX + userId, TTL);
        }
        return changedAt;
    }

    public Instant markOffline(String userId) {
        String key = ONLINE_KEY_PREFIX + userId;
        Long value = stringRedisTemplate.opsForValue().decrement(key);
        Instant changedAt = Instant.now();
        stringRedisTemplate.opsForValue().set(LAST_CHANGE_KEY_PREFIX + userId, changedAt.toString(), TTL);
        if (value == null || value <= 0) {
            stringRedisTemplate.delete(key);
        }
        return changedAt;
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

    public Instant lastChangedAt(String userId) {
        String raw = stringRedisTemplate.opsForValue().get(LAST_CHANGE_KEY_PREFIX + userId);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public Map<String, PresenceStatus> getPresence(List<String> userIds) {
        Map<String, PresenceStatus> result = new HashMap<>();
        if (userIds == null || userIds.isEmpty()) {
            return result;
        }

        List<String> onlineKeys = new ArrayList<>(userIds.size());
        List<String> lastChangeKeys = new ArrayList<>(userIds.size());
        for (String userId : userIds) {
            onlineKeys.add(ONLINE_KEY_PREFIX + userId);
            lastChangeKeys.add(LAST_CHANGE_KEY_PREFIX + userId);
        }

        List<String> onlineValues = stringRedisTemplate.opsForValue().multiGet(onlineKeys);
        List<String> lastChangeValues = stringRedisTemplate.opsForValue().multiGet(lastChangeKeys);

        for (int index = 0; index < userIds.size(); index += 1) {
            String userId = userIds.get(index);
            String onlineRaw = onlineValues == null ? null : onlineValues.get(index);
            String lastChangeRaw = lastChangeValues == null ? null : lastChangeValues.get(index);
            boolean online = parseOnline(onlineRaw);
            Instant changedAt = parseInstant(lastChangeRaw);
            result.put(userId, new PresenceStatus(online, changedAt));
        }

        return result;
    }

    private boolean parseOnline(String raw) {
        if (raw == null) {
            return false;
        }
        try {
            return Long.parseLong(raw) > 0;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public record PresenceStatus(boolean online, Instant lastChangedAt) {
    }
}
