package com.zola.user.repository;

import com.zola.user.entity.FriendshipEntity;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
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

	List<FriendshipEntity> findAllByAddresseeIdAndStatus(UUID addresseeId, String status);

	List<FriendshipEntity> findAllByAddresseeIdAndStatusAndAddresseeViewedAtIsNull(UUID addresseeId, String status);

	long countByAddresseeIdAndStatusAndAddresseeViewedAtIsNull(UUID addresseeId, String status);

	@Modifying
	@Query("""
		update FriendshipEntity f
		set f.addresseeViewedAt = :viewedAt,
		    f.updatedAt = :viewedAt
		where f.addresseeId = :addresseeId
		  and f.status = :status
		  and f.addresseeViewedAt is null
	""")
	int markPendingAsViewed(
		@Param("addresseeId") UUID addresseeId,
		@Param("status") String status,
		@Param("viewedAt") Instant viewedAt
	);

	@Query("""
		select f from FriendshipEntity f
		where ((f.requesterId = :userId and f.status = :status)
		   or (f.addresseeId = :userId and f.status = :status))
	""")
	List<FriendshipEntity> findAllByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") String status);
}