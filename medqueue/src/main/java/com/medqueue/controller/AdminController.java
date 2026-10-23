
package com.medqueue.controller;

import com.medqueue.service.AppointmentService;

import org.springframework.http.ResponseEntity;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AppointmentService appointmentService;


    public AdminController(
            AppointmentService appointmentService) {

        this.appointmentService =
                appointmentService;
    }


    @GetMapping("/statistics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminStatsResponse>
    getStatistics() {

        return ResponseEntity.ok(
                appointmentService
                        .getAdminStatistics()
        );
    }
}

