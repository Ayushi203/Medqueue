
package com.medqueue.service;

import com.medqueue.controller.AdminStatsResponse;
import com.medqueue.controller.AppointmentResponse;
import com.medqueue.controller.NextSlotResponse;
import com.medqueue.controller.PrescriptionResponse;
import com.medqueue.controller.QueueStatusResponse;
import com.medqueue.controller.RatingResponse;
import com.medqueue.controller.SlotResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Doctor;
import com.medqueue.entity.Prescription;
import com.medqueue.entity.Rating;
import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.PrescriptionRepository;
import com.medqueue.repository.RatingRepository;
import com.medqueue.repository.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final RatingRepository ratingRepository;

    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("H:mm");

    private static final DateTimeFormatter AM_PM_FORMATTER =
            DateTimeFormatter.ofPattern("h:mma");

    private static final Set<String> VALID_STATUSES = Set.of(
            "BOOKED",
            "CALLED",
            "COMPLETED",
            "SKIPPED",
            "CANCELLED"
    );

    public AppointmentService(
            AppointmentRepository appointmentRepository,
            UserRepository userRepository,
            DoctorRepository doctorRepository,
            PrescriptionRepository prescriptionRepository,
            RatingRepository ratingRepository) {

        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.ratingRepository = ratingRepository;
    }

    // BOOK APPOINTMENT
    //
    // Double-booking protection:
    //  - the doctor row is locked for the whole transaction, so two bookings
    //    for the same doctor never run their checks at the same time;
    //  - the time must be one of the doctor's fixed slots;
    //  - the slot, the patient's session with this doctor and the patient's
    //    own time are all checked for live (BOOKED/CALLED) bookings;
    //  - a unique key on the active slot is the last line of defence.

    private static final Set<String> LIVE_STATUSES = Set.of("BOOKED", "CALLED");

    @Transactional
    public Appointment bookAppointment(
            Long patientId,
            Long doctorId,
            Appointment appointment) {

        if (patientId == null || doctorId == null) {
            throw new IllegalArgumentException(
                    "Patient ID and doctor ID are required");
        }

        if (appointment == null) {
            throw new IllegalArgumentException(
                    "Appointment details are required");
        }

        User patient = userRepository.findById(patientId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Patient not found"));

        if (patient.getRole() != Role.PATIENT) {
            throw new IllegalArgumentException(
                    "Only patients can book appointments");
        }

        Doctor doctor = lockBookableDoctor(doctorId);

        LocalTime appointmentTime = appointment.getAppointmentTime() == null
                ? null
                : appointment.getAppointmentTime().withSecond(0).withNano(0);

        List<Appointment> session = validateSlot(
                doctor,
                patientId,
                appointment.getAppointmentDate(),
                appointmentTime,
                null);

        Appointment booking = new Appointment();
        booking.setPatient(patient);
        booking.setDoctor(doctor);
        booking.setAppointmentDate(appointment.getAppointmentDate());
        booking.setAppointmentTime(appointmentTime);
        booking.setTokenNumber(nextToken(session));
        booking.setStatus("BOOKED");

        // Flush now so a unique-key clash surfaces here, inside this method
        return appointmentRepository.saveAndFlush(booking);
    }

    // RESCHEDULE: same doctor, new slot, same booking rules

    @Transactional
    public Appointment rescheduleAppointment(
            Long appointmentId,
            Long patientId,
            LocalDate newDate,
            LocalTime newTime) {

        Appointment appointment = getAppointmentById(appointmentId);

        if (!appointment.getPatient().getId().equals(patientId)) {
            throw new IllegalArgumentException(
                    "You can only reschedule your own appointments");
        }

        if (!"BOOKED".equals(appointment.getStatus())) {
            throw new IllegalArgumentException(
                    "Only a booked appointment that has not started can be rescheduled");
        }

        Doctor doctor = lockBookableDoctor(appointment.getDoctor().getId());

        LocalTime time = newTime == null
                ? null
                : newTime.withSecond(0).withNano(0);

        if (appointment.getAppointmentDate().equals(newDate)
                && appointment.getAppointmentTime().equals(time)) {
            throw new IllegalArgumentException(
                    "Please choose a different slot");
        }

        List<Appointment> newSession = validateSlot(
                doctor, patientId, newDate, time, appointment.getId());

        // Keep the token inside the same session, otherwise take the next one
        boolean sameSession = newSession.stream()
                .anyMatch(item -> item.getId().equals(appointment.getId()));

        if (!sameSession) {
            appointment.setTokenNumber(nextToken(newSession));
        }

        appointment.setAppointmentDate(newDate);
        appointment.setAppointmentTime(time);

        // Arrival info belonged to the old slot
        appointment.setArrivalStatus(null);
        appointment.setCheckedInAt(null);
        appointment.setLateMinutes(null);

        return appointmentRepository.saveAndFlush(appointment);
    }

    // CHECK-IN: "I'm here" or "running late"

    private static final int CHECK_IN_OPENS_MINUTES = 3 * 60;
    private static final int MAX_LATE_MINUTES = 120;

    @Transactional
    public Appointment checkIn(
            Long appointmentId,
            Long patientId,
            String arrival,
            Integer lateMinutes) {

        Appointment appointment = getAppointmentById(appointmentId);

        if (!appointment.getPatient().getId().equals(patientId)) {
            throw new IllegalArgumentException(
                    "You can only check in to your own appointments");
        }

        if (!"BOOKED".equals(appointment.getStatus())) {
            throw new IllegalArgumentException(
                    "Check-in is only possible while you are waiting");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime slot = LocalDateTime.of(
                appointment.getAppointmentDate(),
                appointment.getAppointmentTime());

        if (slot.minusMinutes(CHECK_IN_OPENS_MINUTES).isAfter(now)) {
            throw new IllegalArgumentException(
                    "Check-in opens 3 hours before your appointment");
        }

        String normalized = arrival == null ? "" : arrival.trim().toUpperCase();

        if ("ARRIVED".equals(normalized)) {

            appointment.setArrivalStatus("ARRIVED");
            appointment.setLateMinutes(null);

        } else if ("LATE".equals(normalized)) {

            if (lateMinutes == null
                    || lateMinutes < 5
                    || lateMinutes > MAX_LATE_MINUTES) {
                throw new IllegalArgumentException(
                        "Late by must be between 5 and " + MAX_LATE_MINUTES + " minutes");
            }

            appointment.setArrivalStatus("LATE");
            appointment.setLateMinutes(lateMinutes);

        } else {
            throw new IllegalArgumentException(
                    "Check-in must be ARRIVED or LATE");
        }

        appointment.setCheckedInAt(now);

        return appointmentRepository.save(appointment);
    }

    // AUTO-CLOSE STALE APPOINTMENTS
    //
    // Anything still BOOKED or CALLED this long after its slot was never
    // finished by the doctor. BOOKED becomes SKIPPED (no-show); CALLED becomes
    // COMPLETED without a finish time, because we don't know when it ended
    // (so it never skews the learned consultation average). Both are flagged
    // autoClosed so screens and reports can tell them apart.

    public static final int STALE_AFTER_HOURS = 12;

    @Transactional
    public int closeStaleAppointments(LocalDateTime now) {

        LocalDateTime cutoff = now.minusHours(STALE_AFTER_HOURS);
        int closed = 0;

        for (Appointment appointment
                : appointmentRepository.findByStatusIn(LIVE_STATUSES)) {

            LocalDateTime slot = LocalDateTime.of(
                    appointment.getAppointmentDate(),
                    appointment.getAppointmentTime());

            if (!slot.isBefore(cutoff)) {
                continue;
            }

            if ("CALLED".equals(appointment.getStatus())) {
                appointment.setStatus("COMPLETED");
                appointment.setCompletedAt(null);
            } else {
                appointment.setStatus("SKIPPED");
            }

            appointment.setAutoClosed(true);
            appointmentRepository.save(appointment);
            closed++;
        }

        return closed;
    }

    // WALK-IN: the doctor adds someone at the clinic to the running session

    private static final int WALK_IN_OPENS_BEFORE_MINUTES = 60;

    @Transactional
    public Appointment addWalkIn(
            Long doctorId,
            String name,
            String phone) {

        String patientName = name == null ? "" : name.trim();

        if (patientName.isEmpty() || patientName.length() > 100) {
            throw new IllegalArgumentException(
                    "Patient name is required");
        }

        String digits = phone == null ? "" : phone.replaceAll("[\\s-]", "");

        if (!digits.isEmpty() && !digits.matches("^\\+?\\d{10,13}$")) {
            throw new IllegalArgumentException(
                    "Phone number must be 10 digits");
        }

        Doctor doctor = lockBookableDoctor(doctorId);

        LocalDateTime now = LocalDateTime.now();

        // Seconds are never :00 so a walk-in can't share a booked slot's key
        LocalTime time = now.toLocalTime()
                .withSecond(Math.max(1, now.getSecond()))
                .withNano(0);

        // Only while the doctor's session is (about to be) running
        Shift shift = shiftFor(doctor, now.toLocalDate(), time);

        LocalDateTime sessionStart =
                shift.date.atStartOfDay().plusMinutes(shift.startMinute);
        LocalDateTime sessionEnd =
                shift.date.atStartOfDay().plusMinutes(shift.endMinute);

        if (!isWorkingDay(doctor, shift.date)
                || now.isBefore(sessionStart.minusMinutes(WALK_IN_OPENS_BEFORE_MINUTES))
                || !now.isBefore(sessionEnd)) {
            throw new IllegalArgumentException(
                    "Walk-ins can be added only during your session today");
        }

        // Reuse a known patient with the same phone number, otherwise create one
        User patient = digits.isEmpty()
                ? null
                : userRepository.findFirstByPhoneAndRole(digits, Role.PATIENT).orElse(null);

        if (patient == null) {
            patient = new User();
            patient.setName(patientName);
            patient.setPhone(digits.isEmpty() ? null : digits);
            patient.setRole(Role.PATIENT);
            // Placeholder address; walk-in records have no login
            patient.setEmail("walkin-" + UUID.randomUUID() + "@walkin.medqueue.local");
            // Not a BCrypt hash, so this account can never sign in
            patient.setPassword("!walk-in-no-login");
            patient = userRepository.save(patient);
        }

        List<Appointment> session = shiftAppointments(doctor, shift);
        final Long patientId = patient.getId();

        boolean alreadyQueued = session.stream()
                .anyMatch(existing ->
                        LIVE_STATUSES.contains(existing.getStatus())
                        && existing.getPatient().getId().equals(patientId));

        if (alreadyQueued) {
            throw new IllegalArgumentException(
                    patientName + " is already in today's queue");
        }

        Appointment walkIn = new Appointment();
        walkIn.setPatient(patient);
        walkIn.setDoctor(doctor);
        walkIn.setAppointmentDate(now.toLocalDate());
        walkIn.setAppointmentTime(time);
        walkIn.setTokenNumber(nextToken(session));
        walkIn.setStatus("BOOKED");
        walkIn.setWalkIn(true);
        // They are standing at the clinic
        walkIn.setArrivalStatus("ARRIVED");
        walkIn.setCheckedInAt(now);

        return appointmentRepository.saveAndFlush(walkIn);
    }

    // AVAILABLE SLOTS

    @Transactional(readOnly = true)
    public List<SlotResponse> getSlots(Long doctorId, LocalDate date) {

        if (doctorId == null || date == null) {
            throw new IllegalArgumentException(
                    "Doctor ID and date are required");
        }

        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        if (!doctor.getActive() || date.isBefore(LocalDate.now())) {
            return List.of();
        }

        Set<LocalTime> taken = takenTimes(doctor, date);
        LocalDateTime now = LocalDateTime.now();
        List<SlotResponse> result = new ArrayList<>();

        for (LocalTime slot : slotTimesFor(doctor, date)) {

            boolean past = LocalDateTime.of(date, slot).isBefore(now);

            result.add(new SlotResponse(
                    slot,
                    !past && !taken.contains(slot)));
        }

        return result;
    }

    // NEXT FREE SLOT for every active doctor (looks up to 30 days ahead)

    private static final int NEXT_FREE_SEARCH_DAYS = 30;

    @Transactional(readOnly = true)
    public List<NextSlotResponse> getNextFreeSlots() {

        LocalDateTime now = LocalDateTime.now();
        List<NextSlotResponse> result = new ArrayList<>();

        for (Doctor doctor : doctorRepository.findAll()) {

            if (!doctor.getActive()) {
                continue;
            }

            try {
                NextSlotResponse next = findNextFree(doctor, now);

                if (next != null) {
                    result.add(next);
                }
            } catch (IllegalArgumentException misconfigured) {
                // A doctor with an unreadable schedule simply shows no next slot
            }
        }

        return result;
    }

    private NextSlotResponse findNextFree(Doctor doctor, LocalDateTime now) {

        for (int day = 0; day <= NEXT_FREE_SEARCH_DAYS; day++) {

            LocalDate date = now.toLocalDate().plusDays(day);
            List<LocalTime> times = slotTimesFor(doctor, date);

            if (times.isEmpty()) {
                continue;
            }

            Set<LocalTime> taken = takenTimes(doctor, date);

            for (LocalTime time : times) {
                if (!taken.contains(time)
                        && LocalDateTime.of(date, time).isAfter(now)) {
                    return new NextSlotResponse(doctor.getId(), date, time);
                }
            }
        }

        return null;
    }

    // BOOKING HELPERS

    private Doctor lockBookableDoctor(Long doctorId) {

        Doctor doctor = doctorRepository.findByIdForUpdate(doctorId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        if (!doctor.getActive()) {
            throw new IllegalArgumentException(
                    "This doctor is not accepting appointments");
        }

        return doctor;
    }

    private Set<LocalTime> takenTimes(Doctor doctor, LocalDate date) {

        Set<LocalTime> taken = new HashSet<>();

        for (Appointment existing : appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByTokenNumber(doctor.getId(), date)) {

            if (LIVE_STATUSES.contains(existing.getStatus())) {
                taken.add(existing.getAppointmentTime());
            }
        }

        return taken;
    }

    // Checks a requested slot and returns everyone in that session.
    // ignoreId: the appointment being moved (reschedule), so it never clashes with itself.
    private List<Appointment> validateSlot(
            Doctor doctor,
            Long patientId,
            LocalDate date,
            LocalTime time,
            Long ignoreId) {

        if (date == null || time == null) {
            throw new IllegalArgumentException(
                    "Appointment date and time are required");
        }

        LocalDate today = LocalDate.now();

        if (date.isBefore(today)) {
            throw new IllegalArgumentException(
                    "Appointment date cannot be in the past");
        }

        if (date.isAfter(today.plusDays(90))) {
            throw new IllegalArgumentException(
                    "Appointments can be booked up to 90 days ahead");
        }

        if (!slotTimesFor(doctor, date).contains(time)) {
            throw new IllegalArgumentException(
                    "Please choose one of the doctor's available time slots");
        }

        if (LocalDateTime.of(date, time).isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException(
                    "This time slot has already passed");
        }

        // Everyone in the same session; an overnight shift spans two dates
        List<Appointment> session = shiftQueue(doctor, date, time);

        boolean slotTaken = session.stream()
                .anyMatch(existing ->
                        !existing.getId().equals(ignoreId)
                        && LIVE_STATUSES.contains(existing.getStatus())
                        && date.equals(existing.getAppointmentDate())
                        && time.equals(existing.getAppointmentTime()));

        if (slotTaken) {
            throw new IllegalArgumentException(
                    "This time slot is already booked. Please choose another slot.");
        }

        boolean alreadyWithDoctor = session.stream()
                .anyMatch(existing ->
                        !existing.getId().equals(ignoreId)
                        && LIVE_STATUSES.contains(existing.getStatus())
                        && existing.getPatient().getId().equals(patientId));

        if (alreadyWithDoctor) {
            throw new IllegalArgumentException(
                    "You already have an appointment in this doctor's session");
        }

        boolean patientBusy = appointmentRepository
                .findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(patientId)
                .stream()
                .anyMatch(existing ->
                        !existing.getId().equals(ignoreId)
                        && LIVE_STATUSES.contains(existing.getStatus())
                        && date.equals(existing.getAppointmentDate())
                        && time.equals(existing.getAppointmentTime()));

        if (patientBusy) {
            throw new IllegalArgumentException(
                    "You already have another appointment at this time");
        }

        return session;
    }

    // Next token in a session (safe: the doctor row is locked)
    private static int nextToken(List<Appointment> session) {

        int next = 1;

        for (Appointment existing : session) {
            Integer token = existing.getTokenNumber();

            if (token != null && token >= next) {
                next = token + 1;
            }
        }

        return next;
    }

    // SHIFTS
    //
    // A shift is one working session that starts on a date. A normal shift
    // (10:00-14:00) stays on that date. An overnight shift (23:00-03:00) runs
    // into the next date: its end minute is past 1440. Appointments keep
    // their real calendar date, so a 01:00 slot of Monday's night shift is
    // stored on Tuesday, but queues, tokens and estimates treat the whole
    // night as one session.

    private static final int DAY_MINUTES = 24 * 60;

    private static final class Shift {

        final LocalDate date;
        final int startMinute;
        final int endMinute;

        Shift(LocalDate date, int startMinute, int endMinute) {
            this.date = date;
            this.startMinute = startMinute;
            this.endMinute = endMinute;
        }

        boolean overnight() {
            return endMinute > DAY_MINUTES;
        }

        // Minutes after midnight on the next date where the shift ends
        int tailEndMinute() {
            return overnight() ? endMinute - DAY_MINUTES : 0;
        }
    }

    private static int minuteOf(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    private int consultationLength(Doctor doctor) {
        return doctor.getConsultationTime() != null
                && doctor.getConsultationTime() > 0
                ? doctor.getConsultationTime()
                : 15;
    }

    // Slot starts as minutes from the shift date's midnight (may exceed 1440)
    private List<Integer> shiftSlotMinutes(Doctor doctor) {

        int[] hours = getWorkingMinutes(doctor);
        int length = consultationLength(doctor);

        List<Integer> minutes = new ArrayList<>();

        for (int minute = hours[0];
                minute + length <= hours[1];
                minute += length) {
            minutes.add(minute);
        }

        return minutes;
    }

    // Bookable clock times on a calendar date: the early-morning end of the
    // previous evening's overnight shift, plus today's own shift
    private List<LocalTime> slotTimesFor(Doctor doctor, LocalDate date) {

        List<Integer> minutes = shiftSlotMinutes(doctor);
        List<LocalTime> times = new ArrayList<>();

        if (isWorkingDay(doctor, date.minusDays(1))) {
            for (int minute : minutes) {
                if (minute >= DAY_MINUTES) {
                    int clock = minute - DAY_MINUTES;
                    times.add(LocalTime.of(clock / 60, clock % 60));
                }
            }
        }

        if (isWorkingDay(doctor, date)) {
            for (int minute : minutes) {
                if (minute < DAY_MINUTES) {
                    times.add(LocalTime.of(minute / 60, minute % 60));
                }
            }
        }

        return times;
    }

    // The shift a given date and time belong to
    private Shift shiftFor(Doctor doctor, LocalDate date, LocalTime time) {

        int[] hours = getWorkingMinutes(doctor);
        Shift sameDay = new Shift(date, hours[0], hours[1]);

        boolean morningOfPreviousShift = sameDay.overnight()
                && minuteOf(time) < sameDay.tailEndMinute();

        return morningOfPreviousShift
                ? new Shift(date.minusDays(1), hours[0], hours[1])
                : sameDay;
    }

    // All appointments of a shift, in the order the doctor will see them
    private List<Appointment> shiftAppointments(Doctor doctor, Shift shift) {

        List<Appointment> items = new ArrayList<>(
                appointmentRepository
                        .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(
                                doctor.getId(),
                                shift.date));

        if (shift.overnight()) {

            int tailEnd = shift.tailEndMinute();

            // Early-morning rows on the start date belong to the previous night
            items.removeIf(item -> minuteOf(item.getAppointmentTime()) < tailEnd);

            for (Appointment item : appointmentRepository
                    .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(
                            doctor.getId(),
                            shift.date.plusDays(1))) {

                if (minuteOf(item.getAppointmentTime()) < tailEnd) {
                    items.add(item);
                }
            }
        }

        items.sort(Comparator
                .comparing((Appointment item) -> LocalDateTime.of(
                        item.getAppointmentDate(), item.getAppointmentTime()))
                .thenComparing(Appointment::getTokenNumber,
                        Comparator.nullsLast(Comparator.naturalOrder())));

        return items;
    }

    private List<Appointment> shiftQueue(
            Doctor doctor,
            LocalDate date,
            LocalTime time) {

        return shiftAppointments(doctor, shiftFor(doctor, date, time));
    }

    private boolean isWorkingDay(Doctor doctor, LocalDate date) {

        String availableDays = doctor.getAvailableDays();

        if (availableDays == null || availableDays.isBlank()) {
            throw new IllegalArgumentException(
                    "Doctor availability days are not configured");
        }

        String dayName = date.getDayOfWeek().name().substring(0, 3);

        for (String day : availableDays.toUpperCase().split(",")) {
            if (day.trim().equals(dayName)) {
                return true;
            }
        }

        return false;
    }

    // Start and end in minutes from the shift date's midnight; end may exceed 1440
    private int[] getWorkingMinutes(Doctor doctor) {

        String availableTime = doctor.getAvailableTime();

        if (availableTime == null || availableTime.isBlank()) {
            throw new IllegalArgumentException(
                    "Doctor availability time is not configured");
        }

        String cleanedTime = availableTime.trim()
                .replace("–", "-")
                .replace("—", "-")
                .replace("−", "-");

        String[] timeRange = cleanedTime.split("\\s*-\\s*");

        if (timeRange.length != 2) {
            throw new IllegalArgumentException(
                    "Doctor availability time format is invalid");
        }

        LocalTime startTime;
        LocalTime endTime;

        try {
            startTime = parseDoctorTime(timeRange[0]);
            endTime = parseDoctorTime(timeRange[1]);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                    "Invalid doctor availability time: " + availableTime);
        }

        int start = startTime.getHour() * 60 + startTime.getMinute();
        int end = endTime.getHour() * 60 + endTime.getMinute();

        // End at or before the start: the shift runs past midnight
        // (00:00 as the end simply means midnight)
        if (end <= start) {
            end += DAY_MINUTES;
        }

        return new int[] { start, end };
    }

    // PARSE DOCTOR AVAILABLE TIME

    private LocalTime parseDoctorTime(String time) {

        if (time == null || time.isBlank()) {
            throw new IllegalArgumentException(
                    "Doctor availability time is empty");
        }

        String value = time.trim()
                .replace(" ", "")
                .toUpperCase();

        // Formats such as 900, 0900, 1700

        if (value.matches("\\d{3,4}")) {
            int numericTime = Integer.parseInt(value);
            int hour = numericTime / 100;
            int minute = numericTime % 100;

            if (hour > 23 || minute > 59) {
                throw new IllegalArgumentException(
                        "Invalid doctor availability time");
            }

            return LocalTime.of(hour, minute);
        }

        // Formats such as 09:00 and 9:00

        try {
            return LocalTime.parse(
                    value,
                    TIME_FORMATTER);
        } catch (DateTimeParseException ignored) {
            // Try AM/PM format.
        }

        // Formats such as 9:00AM and 5:00PM

        try {
            return LocalTime.parse(
                    value,
                    AM_PM_FORMATTER);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    "Invalid doctor availability time: " + time);
        }
    }

    // GET PATIENT APPOINTMENTS

    @Transactional(readOnly = true)
    public List<Appointment> getPatientAppointments(Long patientId) {

        if (patientId == null) {
            throw new IllegalArgumentException(
                    "Patient ID is required");
        }

        return appointmentRepository
                .findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(patientId);
    }

    // GET DOCTOR QUEUE

    @Transactional(readOnly = true)
    public List<Appointment> getDoctorQueue(
            Long doctorId,
            LocalDate date) {

        if (doctorId == null || date == null) {
            throw new IllegalArgumentException(
                    "Doctor ID and queue date are required");
        }

        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Doctor not found"));

        // The session that starts on this date (runs into the next date if overnight)
        int[] hours = getWorkingMinutes(doctor);

        return shiftAppointments(doctor, new Shift(date, hours[0], hours[1]));
    }

    // GET APPOINTMENT BY ID

    @Transactional(readOnly = true)
    public Appointment getAppointmentById(Long id) {

        if (id == null) {
            throw new IllegalArgumentException(
                    "Appointment ID is required");
        }

        return appointmentRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Appointment not found"));
    }

    // UPDATE APPOINTMENT STATUS

    @Transactional
    public Appointment updateStatus(Long id, String status) {

        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException(
                    "Appointment status is required");
        }

        String normalizedStatus = status.trim().toUpperCase();

        if (!VALID_STATUSES.contains(normalizedStatus)) {
            throw new IllegalArgumentException(
                    "Invalid appointment status: " + status);
        }

        Appointment appointment = getAppointmentById(id);
        String currentStatus = appointment.getStatus();

        if ("CANCELLED".equals(currentStatus)) {
            throw new IllegalArgumentException(
                    "Cancelled appointment cannot be updated");
        }

        if ("COMPLETED".equals(currentStatus)
                && !"COMPLETED".equals(normalizedStatus)) {
            throw new IllegalArgumentException(
                    "Completed appointment cannot be changed");
        }

        if ("SKIPPED".equals(currentStatus)
                && !"SKIPPED".equals(normalizedStatus)) {
            throw new IllegalArgumentException(
                    "Skipped appointment cannot be changed");
        }

        if ("BOOKED".equals(currentStatus)
                && "COMPLETED".equals(normalizedStatus)) {
            throw new IllegalArgumentException(
                    "Call the patient before completing the appointment");
        }

        LocalDateTime now = LocalDateTime.now();

        // Only one patient can be called at a time.

        if ("CALLED".equals(normalizedStatus)
                && !"CALLED".equals(currentStatus)) {

            List<Appointment> queue =
                    shiftQueue(
                            appointment.getDoctor(),
                            appointment.getAppointmentDate(),
                            appointment.getAppointmentTime());

            for (Appointment item : queue) {
                if ("CALLED".equals(item.getStatus())
                        && !item.getId().equals(appointment.getId())) {
                    throw new IllegalArgumentException(
                            "Another patient is currently being served");
                }
            }

            appointment.setCalledAt(now);
            appointment.setCompletedAt(null);
        }

        // Complete consultation.

        if ("COMPLETED".equals(normalizedStatus)) {

            if (!"CALLED".equals(currentStatus)) {
                throw new IllegalArgumentException(
                        "Only a called patient can be marked completed");
            }

            appointment.setCompletedAt(now);
        }

        // Mark a patient as skipped.

        if ("SKIPPED".equals(normalizedStatus)) {

            if (!"BOOKED".equals(currentStatus)
                    && !"CALLED".equals(currentStatus)) {
                throw new IllegalArgumentException(
                        "Only a booked or called patient can be skipped");
            }

            if (appointment.getCalledAt() == null) {
                appointment.setCalledAt(now);
            }

            appointment.setCompletedAt(now);
        }

        // Cancel appointment.

        if ("CANCELLED".equals(normalizedStatus)) {

            if ("COMPLETED".equals(currentStatus)
                    || "SKIPPED".equals(currentStatus)) {
                throw new IllegalArgumentException(
                        "Completed or skipped appointment cannot be cancelled");
            }

            appointment.setCompletedAt(null);
        }

        appointment.setStatus(normalizedStatus);

        return appointmentRepository.save(appointment);
    }

    // SMART QUEUE STATUS
    //
    // Simulates the doctor's queue forward from "now":
    //  1. Learns the real consultation length from the doctor's recent
    //     consultations (today's weighted higher), blended with the
    //     configured consultation time when there is little history.
    //  2. Starts from the remaining time of the patient currently inside.
    //  3. Walks every waiting patient ahead in queue order; nobody is seen
    //     before their booked slot, so gaps in the schedule are respected.

    private static final int MIN_CONSULTATION_SECONDS = 60;
    private static final int MAX_CONSULTATION_SECONDS = 120 * 60;

    // Weight of the configured time against learned samples
    private static final double CONFIGURED_TIME_WEIGHT = 3.0;

    @Transactional(readOnly = true)
    public QueueStatusResponse getQueueStatus(Long id) {

        QueueStatusResponse response = estimateQueue(id);

        Appointment appointment = getAppointmentById(id);

        List<Appointment> queue =
                shiftQueue(
                        appointment.getDoctor(),
                        appointment.getAppointmentDate(),
                        appointment.getAppointmentTime());

        int served = 0;
        boolean started = false;

        List<Long> order = queue.stream()
                .map(Appointment::getId)
                .toList();

        int ownIndex = order.indexOf(appointment.getId());

        for (Appointment item : queue) {

            if (item.getCalledAt() != null) {
                started = true;
            }

            if (item.getId().equals(appointment.getId())) {
                continue;
            }

            // The shift queue is already in visiting order
            boolean before = order.indexOf(item.getId()) < ownIndex;

            if (before && ("COMPLETED".equals(item.getStatus())
                    || "SKIPPED".equals(item.getStatus()))) {
                served++;
            }
        }

        response.setPatientsServed(served);
        response.setDoctorStarted(started);

        // Is the patient with the doctor taking longer than usual?
        LocalDateTime startedAt = response.getCurrentConsultationStartedAt();

        if (startedAt != null) {

            LocalDateTime now = LocalDateTime.now();
            long averageSeconds = learnedAverage(appointment.getDoctor(), now)[0];
            long elapsed = Duration.between(startedAt, now).getSeconds();

            response.setCurrentOverrunning(elapsed > averageSeconds);
            response.setCurrentOverrunMinutes(
                    (int) Math.max(0, (elapsed - averageSeconds) / 60));
        } else {
            response.setCurrentOverrunning(false);
            response.setCurrentOverrunMinutes(0);
        }

        return response;
    }

    // Average consultation length in seconds, learned from the doctor's
    // recent consultations (today's count double) and blended with the
    // configured time when there is little history. Returns {seconds, samples}.
    private long[] learnedAverage(Doctor doctor, LocalDateTime now) {

        List<Appointment> recent =
                appointmentRepository
                        .findTop30ByDoctorIdAndStatusAndCalledAtIsNotNullAndCompletedAtIsNotNullOrderByCompletedAtDesc(
                                doctor.getId(),
                                "COMPLETED");

        int configuredSeconds = 15 * 60;

        if (doctor.getConsultationTime() != null
                && doctor.getConsultationTime() > 0) {
            configuredSeconds = doctor.getConsultationTime() * 60;
        }

        double weightedSum = configuredSeconds * CONFIGURED_TIME_WEIGHT;
        double totalWeight = CONFIGURED_TIME_WEIGHT;
        int samples = 0;

        for (Appointment completed : recent) {

            long seconds = Duration.between(
                    completed.getCalledAt(),
                    completed.getCompletedAt()).getSeconds();

            if (seconds < MIN_CONSULTATION_SECONDS
                    || seconds > MAX_CONSULTATION_SECONDS) {
                continue;
            }

            double weight = now.toLocalDate()
                    .equals(completed.getAppointmentDate()) ? 2.0 : 1.0;

            weightedSum += seconds * weight;
            totalWeight += weight;
            samples++;
        }

        long averageSeconds = Math.round(weightedSum / totalWeight);

        return new long[] { averageSeconds, samples };
    }

    // Learned average in whole minutes, for the doctor's own dashboard
    @Transactional(readOnly = true)
    public int getLearnedAverageMinutes(Doctor doctor) {

        long seconds = learnedAverage(doctor, LocalDateTime.now())[0];

        return (int) Math.max(1, Math.round(seconds / 60.0));
    }

    private QueueStatusResponse estimateQueue(Long id) {

        Appointment appointment = getAppointmentById(id);
        Doctor doctor = appointment.getDoctor();

        LocalDateTime now = LocalDateTime.now();

        List<Appointment> queue =
                shiftQueue(
                        doctor,
                        appointment.getAppointmentDate(),
                        appointment.getAppointmentTime());

        // Learn the average consultation length.

        long[] learned = learnedAverage(doctor, now);
        long averageSeconds = learned[0];
        int samples = (int) learned[1];

        int averageMinutes = (int) Math.max(
                1, Math.round(averageSeconds / 60.0));

        // Patient currently with the doctor.

        Appointment currentAppointment = null;

        for (Appointment item : queue) {
            if ("CALLED".equals(item.getStatus())) {
                currentAppointment = item;
                break;
            }
        }

        int currentToken = currentAppointment == null
                ? 0
                : currentAppointment.getTokenNumber();

        LocalDateTime currentStartedAt = currentAppointment == null
                ? null
                : currentAppointment.getCalledAt();

        String status = appointment.getStatus();

        // Terminal appointment statuses.

        if ("COMPLETED".equals(status)
                || "CANCELLED".equals(status)
                || "SKIPPED".equals(status)) {

            return new QueueStatusResponse(
                    appointment.getId(),
                    appointment.getTokenNumber(),
                    currentToken,
                    0,
                    0L,
                    null,
                    averageMinutes,
                    status,
                    0,
                    currentStartedAt,
                    0,
                    samples,
                    now);
        }

        // The patient is already with the doctor.

        if ("CALLED".equals(status)) {
            return new QueueStatusResponse(
                    appointment.getId(),
                    appointment.getTokenNumber(),
                    appointment.getTokenNumber(),
                    0,
                    0L,
                    appointment.getCalledAt(),
                    averageMinutes,
                    status,
                    0,
                    appointment.getCalledAt(),
                    0,
                    samples,
                    now);
        }

        // Where the doctor's timeline starts.

        // From now; nobody is seen before their slot, so a session that
        // hasn't started yet naturally begins at its first booking.
        LocalDateTime cursor = now;

        if (currentAppointment != null
                && currentAppointment.getCalledAt() != null) {

            long elapsed = Math.max(0, Duration.between(
                    currentAppointment.getCalledAt(), now).getSeconds());

            // If the consultation is overrunning, still allow a short buffer.
            long overrunBuffer = Math.max(60, averageSeconds / 10);

            long remaining = Math.max(
                    averageSeconds - elapsed,
                    overrunBuffer);

            cursor = now.plusSeconds(remaining);
        }

        // Simulate everyone waiting ahead of this patient.

        int patientsAhead = 0;

        for (Appointment item : queue) {

            if (item.getId().equals(appointment.getId())) {
                break;
            }

            if (!"BOOKED".equals(item.getStatus())) {
                continue;
            }

            // Their slot, or later if they said they are running late
            LocalDateTime ready = item.availableFrom();

            LocalDateTime start = cursor.isBefore(ready) ? ready : cursor;

            cursor = start.plusSeconds(averageSeconds);
            patientsAhead++;
        }

        LocalDateTime ownSlot = LocalDateTime.of(
                appointment.getAppointmentDate(), appointment.getAppointmentTime());

        LocalDateTime ownReady = appointment.availableFrom();

        LocalDateTime estimatedStart =
                cursor.isBefore(ownReady) ? ownReady : cursor;

        long waitingSeconds = Math.max(
                0, Duration.between(now, estimatedStart).getSeconds());

        int delayMinutes = (int) Math.max(
                0, Duration.between(ownSlot, estimatedStart).toMinutes());

        return new QueueStatusResponse(
                appointment.getId(),
                appointment.getTokenNumber(),
                currentToken,
                patientsAhead,
                waitingSeconds,
                estimatedStart.withNano(0),
                averageMinutes,
                status,
                patientsAhead + 1,
                currentStartedAt,
                delayMinutes,
                samples,
                now.withNano(0));
    }

    // RESPONSES WITH PRESCRIPTION AND RATING ATTACHED

    @Transactional(readOnly = true)
    public List<AppointmentResponse> toResponses(
            List<Appointment> appointments) {

        if (appointments.isEmpty()) {
            return List.of();
        }

        List<Long> ids = appointments.stream()
                .map(Appointment::getId)
                .toList();

        Map<Long, PrescriptionResponse> prescriptions = new HashMap<>();

        for (Prescription prescription
                : prescriptionRepository.findByAppointmentIdIn(ids)) {
            prescriptions.put(
                    prescription.getAppointment().getId(),
                    new PrescriptionResponse(prescription));
        }

        Map<Long, RatingResponse> ratings = new HashMap<>();

        for (Rating rating : ratingRepository.findByAppointmentIdIn(ids)) {
            ratings.put(
                    rating.getAppointment().getId(),
                    new RatingResponse(rating));
        }

        List<AppointmentResponse> responses = new ArrayList<>();

        for (Appointment appointment : appointments) {
            AppointmentResponse response = new AppointmentResponse(appointment);
            response.setPrescription(prescriptions.get(appointment.getId()));
            response.setRating(ratings.get(appointment.getId()));
            responses.add(response);
        }

        return responses;
    }

    // VISIT HISTORY

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getPatientHistory(Long patientId) {

        if (patientId == null) {
            throw new IllegalArgumentException(
                    "Patient ID is required");
        }

        return toResponses(
                appointmentRepository
                        .findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(
                                patientId));
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getDoctorHistory(Long doctorId) {

        List<Appointment> visits =
                appointmentRepository
                        .findByDoctorIdAndAppointmentDateLessThanEqualOrderByAppointmentDateDescAppointmentTimeDesc(
                                doctorId,
                                LocalDate.now())
                        .stream()
                        .filter(item ->
                                "COMPLETED".equals(item.getStatus())
                                || "SKIPPED".equals(item.getStatus()))
                        .toList();

        return toResponses(visits);
    }

    // ADMIN STATISTICS

    @Transactional(readOnly = true)
    public AdminStatsResponse getAdminStatistics() {

        long totalDoctors = doctorRepository.count();

        long totalPatients =
                userRepository.countByRole(Role.PATIENT);

        long totalAppointments = appointmentRepository.count();

        long bookedAppointments =
                appointmentRepository.countByStatus("BOOKED");

        long completedAppointments =
                appointmentRepository.countByStatus("COMPLETED");

        long cancelledAppointments =
                appointmentRepository.countByStatus("CANCELLED");

        long skippedAppointments =
                appointmentRepository.countByStatus("SKIPPED");

        long calledAppointments =
                appointmentRepository.countByStatus("CALLED");

        return new AdminStatsResponse(
                totalDoctors,
                totalPatients,
                totalAppointments,
                bookedAppointments,
                completedAppointments,
                cancelledAppointments,
                skippedAppointments,
                calledAppointments);
    }
}
