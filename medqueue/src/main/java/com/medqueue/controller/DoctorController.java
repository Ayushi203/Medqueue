package com.medqueue.controller;

import com.medqueue.entity.Doctor;
import com.medqueue.entity.User;
import com.medqueue.repository.UserRepository;
import com.medqueue.service.AppointmentService;
import com.medqueue.service.DoctorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;
    private final UserRepository userRepository;
    private final AppointmentService appointmentService;

    public DoctorController(
            DoctorService doctorService,
            UserRepository userRepository,
            AppointmentService appointmentService) {

        this.doctorService = doctorService;
        this.userRepository = userRepository;
        this.appointmentService = appointmentService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Doctor> createDoctor(
            @RequestBody DoctorCreateRequest request) {

        return ResponseEntity.ok(
                doctorService.createDoctor(request)
        );
    }

    // Public list shows active doctors; admins can ask for inactive ones too
    @GetMapping
    public ResponseEntity<List<Doctor>> getAllDoctors(
            @RequestParam(defaultValue = "false") boolean includeInactive,
            org.springframework.security.core.Authentication authentication) {

        boolean isAdmin = authentication != null
                && authentication.getAuthorities().stream()
                        .anyMatch(authority ->
                                "ROLE_ADMIN".equals(authority.getAuthority()));

        return ResponseEntity.ok(
                doctorService.getAllDoctors(includeInactive && isAdmin)
        );
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Doctor> getMyDoctorProfile(
            org.springframework.security.core.Authentication authentication) {

        String email = authentication.getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Logged-in doctor account not found"
                        )
                );

        Doctor doctor = doctorService.getDoctorByUserId(user.getId());

        // Same learned average the patients' wait estimates use
        doctor.setLearnedConsultationMinutes(
                appointmentService.getLearnedAverageMinutes(doctor));

        return ResponseEntity.ok(doctor);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Doctor> getDoctorById(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                doctorService.getDoctorById(id)
        );
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Doctor> updateDoctor(
            @PathVariable Long id,
            @RequestBody DoctorCreateRequest request) {

        return ResponseEntity.ok(
                doctorService.updateDoctor(id, request)
        );
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Doctor> deactivateDoctor(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                doctorService.setActive(id, false)
        );
    }

    @PutMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Doctor> activateDoctor(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                doctorService.setActive(id, true)
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteDoctor(
            @PathVariable Long id) {

        doctorService.deleteDoctor(id);

        return ResponseEntity.ok(
                "Doctor and login account deleted successfully"
        );
    }
}