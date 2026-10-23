package com.medqueue.service;

import com.medqueue.controller.DoctorCreateRequest;
import com.medqueue.entity.Doctor;
import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class DoctorService {

    private static final List<String> WEEK =
            List.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN");

    private static final Set<Integer> CONSULTATION_TIMES =
            Set.of(5, 10, 15, 20, 30, 45, 60);

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final RatingService ratingService;

    public DoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            AppointmentRepository appointmentRepository,
            PasswordEncoder passwordEncoder,
            RatingService ratingService) {

        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.ratingService = ratingService;
    }

    // Attach average rating and rating count to each doctor
    private List<Doctor> withRatings(List<Doctor> doctors) {

        Map<Long, double[]> averages =
                ratingService.getAllDoctorAverages();

        for (Doctor doctor : doctors) {
            double[] summary = averages.get(doctor.getId());

            doctor.setAverageRating(summary == null ? null : summary[0]);
            doctor.setRatingCount(summary == null ? 0L : (long) summary[1]);
        }

        return doctors;
    }

    // ============================================================
    // CREATE DOCTOR + LOGIN ACCOUNT (both or neither)
    // ============================================================

    @Transactional
    public Doctor createDoctor(
            DoctorCreateRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Doctor details are required");
        }

        if (request.getPassword() == null
                || request.getPassword().length() < 6) {
            throw new IllegalArgumentException(
                    "Doctor password must be at least 6 characters");
        }

        DoctorDetails details = validate(request);

        if (userRepository.existsByEmail(details.email)) {
            throw new IllegalArgumentException(
                    "Email is already registered");
        }

        User user = new User();
        user.setName(details.name);
        user.setEmail(details.email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(details.phone);
        user.setRole(Role.DOCTOR);

        User savedUser = userRepository.save(user);

        Doctor doctor = new Doctor();
        apply(doctor, details);
        doctor.setActive(true);

        // Connect doctor profile to login user
        doctor.setUserId(savedUser.getId());

        return doctorRepository.save(doctor);
    }

    // ============================================================
    // GET DOCTORS
    // ============================================================

    // Patients only ever see active doctors
    public List<Doctor> getAllDoctors(boolean includeInactive) {

        List<Doctor> doctors = doctorRepository.findAll()
                .stream()
                .filter(doctor -> includeInactive || doctor.getActive())
                .toList();

        return withRatings(new ArrayList<>(doctors));
    }

    public Doctor getDoctorById(Long id) {

        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Doctor not found"));

        return withRatings(List.of(doctor)).get(0);
    }

    public Doctor getDoctorByUserId(Long userId) {

        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Doctor profile not found"));

        return withRatings(List.of(doctor)).get(0);
    }

    // ============================================================
    // UPDATE DOCTOR (profile and login kept in sync)
    // ============================================================

    @Transactional
    public Doctor updateDoctor(
            Long id,
            DoctorCreateRequest request) {

        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        DoctorDetails details = validate(request);

        User user = doctor.getUserId() == null
                ? null
                : userRepository.findById(doctor.getUserId()).orElse(null);

        boolean emailChanged = user == null
                ? !details.email.equalsIgnoreCase(doctor.getEmail())
                : !details.email.equalsIgnoreCase(user.getEmail());

        if (emailChanged && userRepository.existsByEmail(details.email)) {
            throw new IllegalArgumentException(
                    "Email is already registered");
        }

        apply(doctor, details);

        if (user != null) {
            user.setName(details.name);
            user.setEmail(details.email);
            user.setPhone(details.phone);

            // Optional password reset
            String password = request.getPassword();

            if (password != null && !password.isEmpty()) {

                if (password.length() < 6) {
                    throw new IllegalArgumentException(
                            "Doctor password must be at least 6 characters");
                }

                user.setPassword(passwordEncoder.encode(password));
            }

            userRepository.save(user);
        }

        return withRatings(List.of(doctorRepository.save(doctor))).get(0);
    }

    // ============================================================
    // ACTIVATE / DEACTIVATE
    // ============================================================

    @Transactional
    public Doctor setActive(Long id, boolean active) {

        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        doctor.setActive(active);

        return withRatings(List.of(doctorRepository.save(doctor))).get(0);
    }

    // ============================================================
    // DELETE (only doctors who never had an appointment)
    // ============================================================

    @Transactional
    public void deleteDoctor(Long id) {

        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        if (appointmentRepository.existsByDoctorId(id)) {
            throw new IllegalArgumentException(
                    "This doctor has appointment history and cannot be deleted. "
                            + "Deactivate the doctor instead.");
        }

        doctorRepository.delete(doctor);

        if (doctor.getUserId() != null) {
            userRepository.deleteById(doctor.getUserId());
        }
    }

    // ============================================================
    // VALIDATION
    // ============================================================

    private static class DoctorDetails {
        String name;
        String email;
        String phone;
        String specialization;
        int consultationTime;
        String availableDays;
        String availableTime;
    }

    private DoctorDetails validate(DoctorCreateRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Doctor details are required");
        }

        DoctorDetails details = new DoctorDetails();

        details.name = required(request.getName(), "Doctor name");
        details.specialization =
                required(request.getSpecialization(), "Specialization");

        String email = required(request.getEmail(), "Email").toLowerCase();

        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("Enter a valid email address");
        }

        details.email = email;

        String phone = request.getPhone() == null
                ? ""
                : request.getPhone().replaceAll("[\\s-]", "");

        if (!phone.isEmpty() && !phone.matches("^\\+?\\d{10,13}$")) {
            throw new IllegalArgumentException(
                    "Phone number must be 10 digits");
        }

        details.phone = phone.isEmpty() ? null : phone;

        Integer consultation = request.getConsultationTime();

        if (consultation == null || !CONSULTATION_TIMES.contains(consultation)) {
            throw new IllegalArgumentException(
                    "Consultation time must be one of " + sorted(CONSULTATION_TIMES) + " minutes");
        }

        details.consultationTime = consultation;
        details.availableDays = normalizeDays(request.getAvailableDays());

        LocalTime[] hours = parseHours(request.getAvailableTime());

        int start = hours[0].getHour() * 60 + hours[0].getMinute();
        int end = hours[1].getHour() * 60 + hours[1].getMinute();

        // Ending at or before the start means the shift runs past midnight
        if (end <= start) {
            end += 24 * 60;
        }

        if (end - start < consultation) {
            throw new IllegalArgumentException(
                    "Working hours are shorter than one consultation");
        }

        details.availableTime = hours[0] + "-" + hours[1];

        return details;
    }

    private void apply(Doctor doctor, DoctorDetails details) {
        doctor.setName(details.name);
        doctor.setEmail(details.email);
        doctor.setPhone(details.phone);
        doctor.setSpecialization(details.specialization);
        doctor.setConsultationTime(details.consultationTime);
        doctor.setAvailableDays(details.availableDays);
        doctor.setAvailableTime(details.availableTime);
    }

    private static String required(String value, String label) {

        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(label + " is required");
        }

        return value.trim();
    }

    // "mon, Tue,FRI" -> "MON,TUE,FRI" in week order
    private static String normalizeDays(String days) {

        if (days == null || days.isBlank()) {
            throw new IllegalArgumentException(
                    "Select at least one working day");
        }

        Set<String> selected = new LinkedHashSet<>();

        for (String part : days.toUpperCase().split(",")) {

            String day = part.trim();

            if (day.length() > 3) {
                day = day.substring(0, 3);
            }

            if (day.isEmpty()) {
                continue;
            }

            if (!WEEK.contains(day)) {
                throw new IllegalArgumentException(
                        "Unknown working day: " + part.trim());
            }

            selected.add(day);
        }

        if (selected.isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one working day");
        }

        List<String> ordered = new ArrayList<>();

        for (String day : WEEK) {
            if (selected.contains(day)) {
                ordered.add(day);
            }
        }

        return String.join(",", ordered);
    }

    // "10:00-14:00" -> [10:00, 14:00]
    private static LocalTime[] parseHours(String value) {

        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    "Working hours are required");
        }

        String[] parts = value.trim().split("\\s*-\\s*");

        if (parts.length != 2) {
            throw new IllegalArgumentException(
                    "Working hours must look like 10:00-14:00");
        }

        try {
            LocalTime start = LocalTime.parse(pad(parts[0]));
            LocalTime end = LocalTime.parse(pad(parts[1]));

            // Same start and end is only allowed as a full day (00:00-00:00);
            // an end before the start is an overnight shift
            if (end.equals(start) && !start.equals(LocalTime.MIDNIGHT)) {
                throw new IllegalArgumentException(
                        "Start and end time cannot be the same");
            }

            return new LocalTime[] { start, end };

        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    "Working hours must look like 10:00-14:00");
        }
    }

    private static String pad(String time) {
        return time.length() == 4 ? "0" + time : time;
    }

    private static List<Integer> sorted(Set<Integer> values) {
        return values.stream().sorted().toList();
    }
}
