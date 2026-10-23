package com.medqueue.controller;

import com.medqueue.service.CurrentUserService;
import com.medqueue.service.RatingService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ratings")
public class RatingController {

    private final RatingService ratingService;
    private final CurrentUserService currentUserService;

    public RatingController(
            RatingService ratingService,
            CurrentUserService currentUserService) {

        this.ratingService = ratingService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/appointment/{appointmentId}")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<RatingResponse> rateAppointment(
            @PathVariable Long appointmentId,
            @RequestBody RatingRequest request,
            Authentication authentication) {

        return ResponseEntity.status(HttpStatus.CREATED).body(
                ratingService.rateAppointment(
                        appointmentId,
                        currentUserService.getUser(authentication),
                        request));
    }

    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('PATIENT','ADMIN')")
    public ResponseEntity<List<RatingResponse>> getPatientRatings(
            @PathVariable Long patientId,
            Authentication authentication) {

        currentUserService.requireSelfOrStaff(authentication, patientId);

        return ResponseEntity.ok(
                ratingService.getPatientRatings(patientId));
    }

    @GetMapping("/doctor/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<DoctorRatingSummary> getMyRatings(
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        return ResponseEntity.ok(
                ratingService.getDoctorSummary(doctorId));
    }

    @GetMapping("/doctor/{doctorId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorRatingSummary> getDoctorRatings(
            @PathVariable Long doctorId) {

        return ResponseEntity.ok(
                ratingService.getDoctorSummary(doctorId));
    }
}
