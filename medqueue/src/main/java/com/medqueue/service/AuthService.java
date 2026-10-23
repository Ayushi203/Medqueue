package com.medqueue.service;

import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       DoctorRepository doctorRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // Public sign-up always creates a patient; doctors are added by the admin
    public User register(String name, String email, String password,
                         String phone) {

        if (name == null || name.trim().isEmpty()) {
            throw new RuntimeException("Name is required");
        }

        if (email == null || !email.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new RuntimeException("A valid email is required");
        }

        if (password == null || password.length() < 6) {
            throw new RuntimeException("Password must be at least 6 characters");
        }

        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();

        user.setName(name.trim());
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(password));
        user.setPhone(phone == null ? null : phone.trim());
        user.setRole(Role.PATIENT);

        return userRepository.save(user);
    }

    public User login(String email, String password) {

        String trimmedEmail = email == null ? "" : email.trim();

        // Exact match first so older mixed-case accounts still work
        User user = userRepository.findByEmail(trimmedEmail)
                .or(() -> userRepository.findByEmail(trimmedEmail.toLowerCase()))
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        if (user.getRole() == Role.DOCTOR) {
            boolean inactive = doctorRepository.findByUserId(user.getId())
                    .map(doctor -> !doctor.getActive())
                    .orElse(false);

            if (inactive) {
                throw new RuntimeException(
                        "This doctor account has been deactivated. Please contact the clinic admin.");
            }
        }

        return user;
    }
}