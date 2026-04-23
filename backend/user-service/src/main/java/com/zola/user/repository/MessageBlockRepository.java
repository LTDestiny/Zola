package com.zola.user.repository;

import com.zola.user.entity.MessageBlockEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageBlockRepository extends JpaRepository<MessageBlockEntity, UUID> {

    Optional<MessageBlockEntity> findByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);

    List<MessageBlockEntity> findAllByBlockerId(UUID blockerId);

    @Query("""
        select b from MessageBlockEntity b
        where (b.blockerId = :userA and b.blockedUserId = :userB)
           or (b.blockerId = :userB and b.blockedUserId = :userA)
    """)
    List<MessageBlockEntity> findAllBetweenUsers(
        @Param("userA") UUID userA,
        @Param("userB") UUID userB
    );
}
