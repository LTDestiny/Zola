package com.zola.chat.infrastructure.persistence.postgres;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationJpaRepository extends JpaRepository<ConversationEntity, UUID> {

    @Query("""
        select c from ConversationEntity c
        where (c.user1Id = :userA and c.user2Id = :userB)
           or (c.user1Id = :userB and c.user2Id = :userA)
        """)
    Optional<ConversationEntity> findDirectConversation(@Param("userA") String userA, @Param("userB") String userB);

    @Query("""
        select c from ConversationEntity c
        where c.user1Id = :userId or c.user2Id = :userId
        order by c.updatedAt desc
        """)
    List<ConversationEntity> findByParticipant(@Param("userId") String userId);

    @Query("""
        select coalesce(sum(
            case
                when c.user1Id = :userId then c.user1UnreadCount
                when c.user2Id = :userId then c.user2UnreadCount
                else 0
            end
        ), 0)
        from ConversationEntity c
        where c.user1Id = :userId or c.user2Id = :userId
        """)
    int sumUnreadByParticipant(@Param("userId") String userId);
}
