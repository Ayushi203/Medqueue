
package com.medqueue.repository;

import com.medqueue.entity.Role;
import com.medqueue.entity.User;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    Optional<User> findFirstByPhoneAndRole(String phone, Role role);
}

