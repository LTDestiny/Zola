package com.zola.chat.presence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/**
 * Production-ready Presence Manager with:
 * - Multi-device support (socket counting)
 * - Delayed offline (15s grace period)
 * - Last seen tracking
 * - Efficient batch operations
 */
@Component
public class PresenceManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(PresenceManager.class);

    // Redis key prefixes
    private static final String SESSION_COUNT_KEY = "presence:user:%s:sessions";
    private static final String LAST_SEEN_KEY = "presence:user:%s:lastSeen";
    private static final String ONLINE_STATUS_KEY = "presence:user:%s:online";
    
    // Configuration
    private static final Duration TTL = Duration.ofHours(24);
    private static final Duration OFFLINE_DELAY = Duration.ofSeconds(15);

    private final StringRedisTemplate redisTemplate;
    private final ScheduledExecutorService scheduler;
    private final Map<String, ScheduledFuture<?>> pendingOfflineTasks;
    private final PresenceEventPublisher eventPublisher;

    public PresenceManager(
        StringRedisTemplate redisTemplate,
        PresenceEventPublisher eventPublisher
    ) {
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
        this.scheduler = Executors.newScheduledThreadPool(2, r -> {
            Thread t = new Thread(r, "presence-scheduler");
            t.setDaemon(true);
            return t;
        });
        this.pendingOfflineTasks = new ConcurrentHashMap<>();
    }

    /**
     * Mark user as online when a new socket session connects.
     * Supports multiple devices/tabs.
     */
    public PresenceState connect(String userId, String sessionId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }

        LOGGER.info("[Presence] User {} connecting, session={}", userId, sessionId);

        // Cancel any pending offline task
        cancelPendingOffline(userId);

        // Increment session count
        String sessionKey = String.format(SESSION_COUNT_KEY, userId);
        Long sessionCount = redisTemplate.opsForValue().increment(sessionKey);
        redisTemplate.expire(sessionKey, TTL);

        // Update online status
        String onlineKey = String.format(ONLINE_STATUS_KEY, userId);
        String wasOnline = redisTemplate.opsForValue().get(onlineKey);
        boolean previouslyOnline = "true".equals(wasOnline);

        redisTemplate.opsForValue().set(onlineKey, "true", TTL);

        // Update last seen
        Instant now = Instant.now();
        String lastSeenKey = String.format(LAST_SEEN_KEY, userId);
        redisTemplate.opsForValue().set(lastSeenKey, now.toString(), TTL);

        PresenceState state = new PresenceState(
            userId,
            true,
            sessionCount != null ? sessionCount.intValue() : 1,
            now
        );

        // Publish event only if transitioning from offline to online
        if (!previouslyOnline) {
            LOGGER.info("[Presence] User {} is now ONLINE (sessions={})", userId, sessionCount);
            eventPublisher.publishPresenceChange(state);
        } else {
            LOGGER.debug("[Presence] User {} already online, sessions={}", userId, sessionCount);
        }

        return state;
    }

    /**
     * Handle socket session disconnect.
     * Applies 15-second grace period before marking offline.
     */
    public void disconnect(String userId, String sessionId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        LOGGER.info("[Presence] User {} disconnecting, session={}", userId, sessionId);

        // Decrement session count
        String sessionKey = String.format(SESSION_COUNT_KEY, userId);
        Long sessionCount = redisTemplate.opsForValue().decrement(sessionKey);

        if (sessionCount == null || sessionCount <= 0) {
            // No more sessions, schedule delayed offline
            redisTemplate.delete(sessionKey);
            scheduleDelayedOffline(userId);
        } else {
            LOGGER.debug("[Presence] User {} still has {} sessions", userId, sessionCount);
        }
    }

    /**
     * Force immediate offline (e.g., for logout).
     */
    public void forceOffline(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        LOGGER.info("[Presence] Force offline for user {}", userId);
        
        cancelPendingOffline(userId);
        markOfflineNow(userId);
    }

    /**
     * Get presence state for a single user.
     */
    public PresenceState getPresence(String userId) {
        if (userId == null || userId.isBlank()) {
            return new PresenceState(userId, false, 0, null);
        }

        String onlineKey = String.format(ONLINE_STATUS_KEY, userId);
        String sessionKey = String.format(SESSION_COUNT_KEY, userId);
        String lastSeenKey = String.format(LAST_SEEN_KEY, userId);

        List<String> keys = List.of(onlineKey, sessionKey, lastSeenKey);
        List<String> values = redisTemplate.opsForValue().multiGet(keys);

        boolean online = values != null && "true".equals(values.get(0));
        int sessionCount = parseSessionCount(values != null ? values.get(1) : null);
        Instant lastSeen = parseInstant(values != null ? values.get(2) : null);

        return new PresenceState(userId, online, sessionCount, lastSeen);
    }

    /**
     * Batch get presence for multiple users.
     * Optimized for chat list rendering.
     */
    public Map<String, PresenceState> getPresenceBatch(List<String> userIds) {
        Map<String, PresenceState> result = new HashMap<>();
        
        if (userIds == null || userIds.isEmpty()) {
            return result;
        }

        List<String> normalizedIds = userIds.stream()
            .filter(id -> id != null && !id.isBlank())
            .map(String::trim)
            .distinct()
            .toList();

        if (normalizedIds.isEmpty()) {
            return result;
        }

        // Build all keys
        List<String> allKeys = new ArrayList<>();
        for (String userId : normalizedIds) {
            allKeys.add(String.format(ONLINE_STATUS_KEY, userId));
            allKeys.add(String.format(SESSION_COUNT_KEY, userId));
            allKeys.add(String.format(LAST_SEEN_KEY, userId));
        }

        // Batch fetch from Redis
        List<String> values = redisTemplate.opsForValue().multiGet(allKeys);

        // Parse results
        for (int i = 0; i < normalizedIds.size(); i++) {
            String userId = normalizedIds.get(i);
            int baseIndex = i * 3;
            
            boolean online = values != null && "true".equals(values.get(baseIndex));
            int sessionCount = parseSessionCount(values != null ? values.get(baseIndex + 1) : null);
            Instant lastSeen = parseInstant(values != null ? values.get(baseIndex + 2) : null);

            result.put(userId, new PresenceState(userId, online, sessionCount, lastSeen));
        }

        return result;
    }

    /**
     * Update last seen timestamp (called periodically or on activity).
     */
    public void updateLastSeen(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        String lastSeenKey = String.format(LAST_SEEN_KEY, userId);
        Instant now = Instant.now();
        redisTemplate.opsForValue().set(lastSeenKey, now.toString(), TTL);
    }

    // ─── PRIVATE METHODS ──────────────────────────────────────────────────────────

    private void scheduleDelayedOffline(String userId) {
        LOGGER.info("[Presence] Scheduling delayed offline for user {} in {}s", userId, OFFLINE_DELAY.toSeconds());

        // Cancel existing task if any
        cancelPendingOffline(userId);

        // Schedule new task
        ScheduledFuture<?> future = scheduler.schedule(
            () -> {
                pendingOfflineTasks.remove(userId);
                
                // Double-check session count before going offline
                String sessionKey = String.format(SESSION_COUNT_KEY, userId);
                String sessionRaw = redisTemplate.opsForValue().get(sessionKey);
                int sessions = parseSessionCount(sessionRaw);
                
                if (sessions <= 0) {
                    markOfflineNow(userId);
                } else {
                    LOGGER.info("[Presence] User {} reconnected during grace period, sessions={}", userId, sessions);
                }
            },
            OFFLINE_DELAY.toMillis(),
            TimeUnit.MILLISECONDS
        );

        pendingOfflineTasks.put(userId, future);
    }

    private void cancelPendingOffline(String userId) {
        ScheduledFuture<?> task = pendingOfflineTasks.remove(userId);
        if (task != null && !task.isDone()) {
            task.cancel(false);
            LOGGER.debug("[Presence] Cancelled pending offline for user {}", userId);
        }
    }

    private void markOfflineNow(String userId) {
        String onlineKey = String.format(ONLINE_STATUS_KEY, userId);
        String lastSeenKey = String.format(LAST_SEEN_KEY, userId);

        // Update status to offline
        redisTemplate.opsForValue().set(onlineKey, "false", TTL);
        
        // Update last seen
        Instant now = Instant.now();
        redisTemplate.opsForValue().set(lastSeenKey, now.toString(), TTL);

        LOGGER.info("[Presence] User {} is now OFFLINE", userId);

        // Publish offline event
        PresenceState state = new PresenceState(userId, false, 0, now);
        eventPublisher.publishPresenceChange(state);
    }

    private int parseSessionCount(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(raw));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Presence state record.
     */
    public record PresenceState(
        String userId,
        boolean online,
        int sessionCount,
        Instant lastSeenAt
    ) {}
}
