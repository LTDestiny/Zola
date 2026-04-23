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

	@Query("""
		select f from FriendshipEntity f
		where f.addresseeId = :addresseeId
		  and upper(f.status) = upper(:status)
	""")
	List<FriendshipEntity> findAllByAddresseeIdAndStatus(
		@Param("addresseeId") UUID addresseeId,
		@Param("status") String status
	);

	@Query("""
		select f from FriendshipEntity f
		where f.requesterId = :requesterId
		  and upper(f.status) = upper(:status)
	""")
	List<FriendshipEntity> findAllByRequesterIdAndStatus(
		@Param("requesterId") UUID requesterId,
		@Param("status") String status
	);

	@Query("""
		select f from FriendshipEntity f
		where f.addresseeId = :addresseeId
		  and upper(f.status) = upper(:status)
		  and f.addresseeViewedAt is null
	""")
	List<FriendshipEntity> findAllByAddresseeIdAndStatusAndAddresseeViewedAtIsNull(
		@Param("addresseeId") UUID addresseeId,
		@Param("status") String status
	);

	@Query("""
		select count(f) from FriendshipEntity f
		where f.addresseeId = :addresseeId
		  and upper(f.status) = upper(:status)
		  and f.addresseeViewedAt is null
	""")
	long countByAddresseeIdAndStatusAndAddresseeViewedAtIsNull(
		@Param("addresseeId") UUID addresseeId,
		@Param("status") String status
	);

	@Modifying
	@Query("""
		update FriendshipEntity f
		set f.addresseeViewedAt = :viewedAt,
		    f.updatedAt = :viewedAt
		where f.addresseeId = :addresseeId
		  and upper(f.status) = upper(:status)
		  and f.addresseeViewedAt is null
	""")
	int markPendingAsViewed(
		@Param("addresseeId") UUID addresseeId,
		@Param("status") String status,
		@Param("viewedAt") Instant viewedAt
	);

	@Query("""
		select f from FriendshipEntity f
		where ((f.requesterId = :userId and upper(f.status) = upper(:status))
		   or (f.addresseeId = :userId and upper(f.status) = upper(:status)))
	""")
	List<FriendshipEntity> findAllByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") String status);

	@Query("""
		select count(f) > 0 from FriendshipEntity f
		where upper(f.status) = upper(:status)
		  and (
		      (f.requesterId = :userA and f.addresseeId = :userB)
		   or (f.requesterId = :userB and f.addresseeId = :userA)
		  )
	""")
	boolean existsAcceptedFriendshipBetweenUsers(
		@Param("userA") UUID userA,
		@Param("userB") UUID userB,
		@Param("status") String status
	);
}
