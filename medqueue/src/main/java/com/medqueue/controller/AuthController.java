package com.medqueue.controller;

import com.medqueue.entity.User;
import com.medqueue.security.JwtService;
import com.medqueue.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    public AuthController(
            AuthService authService,
            JwtService jwtService) {

        this.authService = authService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(
            @RequestBody RegisterRequest request) {

        User user = authService.register(
                request.getName(),
                request.getEmail(),
                request.getPassword(),
                request.getPhone()
        );

        return ResponseEntity.ok(
                new UserResponse(user)
        );
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @RequestBody LoginRequest request) {

        User user = authService.login(
                request.getEmail(),
                request.getPassword()
        );

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole().name()
        );

        LoginResponse response = new LoginResponse(
                token,
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole()
        );

        return ResponseEntity.ok(response);
    }
}