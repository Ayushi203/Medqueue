
package com.medqueue.controller;

import com.medqueue.entity.Prescription;
import com.medqueue.service.CurrentUserService;
import com.medqueue.service.PrescriptionService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final PrescriptionService prescriptionService;
    private final CurrentUserService currentUserService;

    public PrescriptionController(
            PrescriptionService prescriptionService,
            CurrentUserService currentUserService) {
        this.prescriptionService = prescriptionService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/appointment/{appointmentId}")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<PrescriptionResponse> createPrescription(
            @PathVariable Long appointmentId,
            @RequestBody Prescription prescription,
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        try {
            PrescriptionResponse saved =
                    prescriptionService.createPrescription(
                            appointmentId, doctorId, prescription);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(saved);

        } catch (IllegalStateException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @PutMapping("/appointment/{appointmentId}")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<PrescriptionResponse> updatePrescription(
            @PathVariable Long appointmentId,
            @RequestBody Prescription prescription,
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        return ResponseEntity.ok(
                prescriptionService.updatePrescription(
                        appointmentId, doctorId, prescription));
    }

    @GetMapping("/appointment/{appointmentId}")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR','ADMIN')")
    public ResponseEntity<PrescriptionResponse> getByAppointment(
            @PathVariable Long appointmentId,
            Authentication authentication) {

        PrescriptionResponse prescription = prescriptionService
                .getByAppointmentId(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Prescription not found"));

        currentUserService.requireSelfOrStaff(
                authentication, prescription.getPatientId());

        return ResponseEntity.ok(prescription);
    }

    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('PATIENT','DOCTOR','ADMIN')")
    public ResponseEntity<List<PrescriptionResponse>> getPatientPrescriptions(
            @PathVariable Long patientId,
            Authentication authentication) {

        currentUserService.requireSelfOrStaff(authentication, patientId);

        return ResponseEntity.ok(
                prescriptionService.getPatientPrescriptions(patientId));
    }

    @GetMapping("/doctor/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<List<PrescriptionResponse>> getMyPrescriptions(
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        return ResponseEntity.ok(
                prescriptionService.getDoctorPrescriptions(doctorId));
    }
}
