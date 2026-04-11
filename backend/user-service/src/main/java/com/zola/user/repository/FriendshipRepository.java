package com.zola.user.repository;

import com.zola.user.entity.FriendshipEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<FriendshipEntity, UUID> {
	Optional<FriendshipEntity> findByRequesterIdAndAddresseeId(UUID requesterId, UUID addresseeId);

	Optional<FriendshipEntity> findByRequesterIdAndAddresseeIdOrRequesterIdAndAddresseeId(
		UUID requesterId,
		UUID addresseeId,
		UUID reversedRequesterId,
		UUID reversedAddresseeId
	);
}