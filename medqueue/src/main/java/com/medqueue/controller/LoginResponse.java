package com.medqueue.controller;

import com.medqueue.entity.Role;

public class LoginResponse {

    private String token;
    private Long id;
    private String name;
    private String email;
    private String phone;
    private Role role;

    public LoginResponse() {
    }

    public LoginResponse(String token, Long id, String name,
                         String email, String phone, Role role) {

        this.token = token;
        this.id = id;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.role = role;
    }

    public String getToken() {
        return token;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public Role getRole() {
        return role;
    }
}