package com.medqueue.config;

import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// Creates the admin account from application.properties on startup,
// only if no user with that email exists yet. Existing accounts are never changed.
@Component
public class AdminSeeder implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(AdminSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${medqueue.seed-admin.email:}")
    private String email;

    @Value("${medqueue.seed-admin.password:}")
    private String password;

    @Value("${medqueue.seed-admin.name:Administrator}")
    private String name;

    public AdminSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {

        if (email.isBlank() || password.isBlank()) {
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            return;
        }

        User admin = new User();
        admin.setName(name.trim());
        admin.setEmail(normalizedEmail);
        admin.setPassword(passwordEncoder.encode(password));
        admin.setRole(Role.ADMIN);

        userRepository.save(admin);

        log.info("Created admin account {}", normalizedEmail);
    }
}
