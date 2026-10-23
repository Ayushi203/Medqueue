package com.medqueue.service;

import com.medqueue.entity.Appointment;
import com.medqueue.entity.Doctor;
import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.UserRepository;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;

    public CurrentUserService(
            UserRepository userRepository,
            DoctorRepository doctorRepository) {

        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
    }

    // Logged-in user from the JWT subject (email)

    public User getUser(Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("Login required");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() ->
                        new AccessDeniedException("Logged-in account not found"));
    }

    // Doctor profile linked to the logged-in user

    public Doctor getDoctor(Authentication authentication) {

        User user = getUser(authentication);

        Doctor doctor = doctorRepository.findByUserId(user.getId())
                .orElseThrow(() ->
                        new AccessDeniedException("Doctor profile not found"));

        if (!doctor.getActive()) {
            throw new AccessDeniedException(
                    "This doctor account has been deactivated");
        }

        return doctor;
    }

    // Patients: own appointments only. Doctors: their own appointments only. Admins: any.

    public void requireAppointmentAccess(
            Authentication authentication,
            Appointment appointment) {

        User user = getUser(authentication);

        if (user.getRole() == Role.ADMIN) {
            return;
        }

        if (user.getRole() == Role.PATIENT
                && appointment.getPatient().getId().equals(user.getId())) {
            return;
        }

        if (user.getRole() == Role.DOCTOR
                && appointment.getDoctor().getActive()
                && appointment.getDoctor().getUserId() != null
                && appointment.getDoctor().getUserId().equals(user.getId())) {
            return;
        }

        throw new AccessDeniedException(
                "You do not have access to this appointment");
    }

    // Doctors may only open their own queue; admins may open any

    public void requireOwnDoctorOrAdmin(
            Authentication authentication,
            Long doctorId) {

        User user = getUser(authentication);

        if (user.getRole() == Role.ADMIN) {
            return;
        }

        if (user.getRole() == Role.DOCTOR
                && getDoctor(authentication).getId().equals(doctorId)) {
            return;
        }

        throw new AccessDeniedException(
                "You can only view your own queue");
    }

    // Patients may only access their own records; doctors and admins may access any

    public void requireSelfOrStaff(
            Authentication authentication,
            Long patientId) {

        User user = getUser(authentication);

        if (user.getRole() == Role.PATIENT
                && !user.getId().equals(patientId)) {
            throw new AccessDeniedException(
                    "You can only access your own records");
        }
    }
}
