
package com.medqueue.controller;

import com.medqueue.entity.Appointment;
import com.medqueue.service.AppointmentService;
import com.medqueue.service.CurrentUserService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final CurrentUserService currentUserService;

    public AppointmentController(
            AppointmentService appointmentService,
            CurrentUserService currentUserService) {

        this.appointmentService = appointmentService;
        this.currentUserService = currentUserService;
    }


    // Full visit history of a patient, with prescriptions and ratings
    @GetMapping("/history/patient/{patientId}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<List<AppointmentResponse>>
    getPatientHistory(
            @PathVariable Long patientId,
            Authentication authentication) {

        currentUserService.requireSelfOrStaff(authentication, patientId);

        return ResponseEntity.ok(
                appointmentService.getPatientHistory(patientId));
    }


    // Past consultations of the logged-in doctor
    @GetMapping("/history/doctor/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<List<AppointmentResponse>>
    getMyDoctorHistory(
            Authentication authentication) {

        return ResponseEntity.ok(
                appointmentService.getDoctorHistory(
                        currentUserService.getDoctor(authentication).getId()));
    }


    // Bookable time slots for a doctor on a date
    @GetMapping("/slots")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<List<SlotResponse>>
    getAvailableSlots(
            @RequestParam Long doctorId,
            @RequestParam String date) {

        return ResponseEntity.ok(
                appointmentService.getSlots(
                        doctorId,
                        LocalDate.parse(date)));
    }


    // Doctor adds a patient who is at the clinic without a booking
    @PostMapping("/walk-in")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<AppointmentResponse> addWalkIn(
            @RequestBody WalkInRequest request,
            Authentication authentication) {

        Appointment appointment =
                appointmentService.addWalkIn(
                        currentUserService.getDoctor(authentication).getId(),
                        request.getName(),
                        request.getPhone());

        return ResponseEntity.ok(
                new AppointmentResponse(appointment));
    }


    // Earliest free slot of every active doctor, for "Next free" on doctor cards
    @GetMapping("/next-free")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<List<NextSlotResponse>>
    getNextFreeSlots() {

        return ResponseEntity.ok(
                appointmentService.getNextFreeSlots());
    }


    // Move a booked appointment to another slot with the same doctor
    @PutMapping("/{id}/reschedule")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentResponse> rescheduleAppointment(
            @PathVariable Long id,
            @RequestBody Appointment request,
            Authentication authentication) {

        Appointment appointment =
                appointmentService.rescheduleAppointment(
                        id,
                        currentUserService.getUser(authentication).getId(),
                        request.getAppointmentDate(),
                        request.getAppointmentTime());

        return ResponseEntity.ok(
                new AppointmentResponse(appointment));
    }


    // Patient says "I'm here" (ARRIVED) or "running late" (LATE + minutes)
    @PutMapping("/{id}/check-in")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentResponse> checkIn(
            @PathVariable Long id,
            @RequestParam String arrival,
            @RequestParam(required = false) Integer lateMinutes,
            Authentication authentication) {

        Appointment appointment =
                appointmentService.checkIn(
                        id,
                        currentUserService.getUser(authentication).getId(),
                        arrival,
                        lateMinutes);

        return ResponseEntity.ok(
                new AppointmentResponse(appointment));
    }


    // The patient is always the logged-in user; a patientId in the URL is ignored
    @PostMapping("/book")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentResponse> bookAppointment(
            @RequestParam Long doctorId,
            @RequestBody Appointment appointment,
            Authentication authentication) {

        Appointment savedAppointment =
                appointmentService.bookAppointment(
                        currentUserService.getUser(authentication).getId(),
                        doctorId,
                        appointment
                );

        return ResponseEntity.ok(
                new AppointmentResponse(savedAppointment)
        );
    }


    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('PATIENT', 'ADMIN')")
    public ResponseEntity<List<AppointmentResponse>>
    getPatientAppointments(
            @PathVariable Long patientId,
            Authentication authentication) {

        currentUserService.requireSelfOrStaff(authentication, patientId);

        return ResponseEntity.ok(
                appointmentService.toResponses(
                        appointmentService.getPatientAppointments(patientId)));
    }


    @GetMapping("/doctor/{doctorId}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    public ResponseEntity<List<AppointmentResponse>>
    getDoctorQueue(
            @PathVariable Long doctorId,
            @RequestParam String date,
            Authentication authentication) {

        currentUserService.requireOwnDoctorOrAdmin(authentication, doctorId);

        LocalDate appointmentDate =
                LocalDate.parse(date);

        return ResponseEntity.ok(
                appointmentService.toResponses(
                        appointmentService.getDoctorQueue(
                                doctorId,
                                appointmentDate)));
    }


    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<AppointmentResponse>
    getAppointment(
            @PathVariable Long id,
            Authentication authentication) {

        Appointment appointment =
                appointmentService
                        .getAppointmentById(id);

        currentUserService.requireAppointmentAccess(authentication, appointment);

        return ResponseEntity.ok(
                new AppointmentResponse(appointment)
        );
    }


    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    public ResponseEntity<AppointmentResponse>
    updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            Authentication authentication) {

        currentUserService.requireAppointmentAccess(
                authentication,
                appointmentService.getAppointmentById(id));

        Appointment appointment =
                appointmentService.updateStatus(
                        id,
                        status
                );

        return ResponseEntity.ok(
                new AppointmentResponse(appointment)
        );
    }


    @GetMapping("/{id}/queue-status")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<QueueStatusResponse>
    getQueueStatus(
            @PathVariable Long id,
            Authentication authentication) {

        currentUserService.requireAppointmentAccess(
                authentication,
                appointmentService.getAppointmentById(id));

        return ResponseEntity.ok(
                appointmentService.getQueueStatus(id)
        );
    }


    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentResponse>
    cancelAppointment(
            @PathVariable Long id,
            Authentication authentication) {

        Appointment existing =
                appointmentService.getAppointmentById(id);

        currentUserService.requireAppointmentAccess(authentication, existing);

        // Patients can only cancel before they are called in
        if (!"BOOKED".equals(existing.getStatus())) {
            throw new IllegalArgumentException(
                    "Only a booked appointment can be cancelled");
        }

        Appointment appointment =
                appointmentService.updateStatus(
                        id,
                        "CANCELLED"
                );

        return ResponseEntity.ok(
                new AppointmentResponse(appointment)
        );
    }

}
