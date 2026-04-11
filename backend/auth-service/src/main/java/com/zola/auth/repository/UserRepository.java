package com.zola.auth.repository;

import com.zola.auth.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
	Optional<UserEntity> findByEmailIgnoreCase(String email);

	Optional<UserEntity> findByPhone(String phone);
}