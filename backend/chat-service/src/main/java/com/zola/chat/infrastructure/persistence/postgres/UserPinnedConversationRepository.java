package com.zola.chat.infrastructure.persistence.postgres;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserPinnedConversationRepository extends JpaRepository<UserPinnedConversationEntity, Long> {

    Optional<UserPinnedConversationEntity> findByUserIdAndConversationId(String userId, String conversationId);

    boolean existsByUserIdAndConversationId(String userId, String conversationId);

    long countByUserId(String userId);

    void deleteByUserIdAndConversationId(String userId, String conversationId);

    List<UserPinnedConversationEntity> findByUserIdOrderByPinnedAtDesc(String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from UserPinnedConversationEntity p where p.userId = :userId")
    List<UserPinnedConversationEntity> lockByUserId(@Param("userId") String userId);
}
