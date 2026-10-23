package com.medqueue.service;

import com.medqueue.controller.NextSlotResponse;
import com.medqueue.controller.QueueStatusResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Doctor;
import com.medqueue.entity.Role;
import com.medqueue.entity.User;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.PrescriptionRepository;
import com.medqueue.repository.RatingRepository;
import com.medqueue.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Reschedule, check-in, late arrivals in the estimate, and next free slot
class PatientFlowTest {

    private AppointmentRepository appointmentRepository;
    private DoctorRepository doctorRepository;
    private AppointmentService service;
    private Doctor doctor;

    @BeforeEach
    void setUp() {
        appointmentRepository = mock(AppointmentRepository.class);
        doctorRepository = mock(DoctorRepository.class);

        service = new AppointmentService(
                appointmentRepository,
                mock(UserRepository.class),
                doctorRepository,
                mock(PrescriptionRepository.class),
                mock(RatingRepository.class));

        // Open all day, every day, 15-minute slots
        doctor = new Doctor();
        doctor.setId(1L);
        doctor.setName("Dr Test");
        doctor.setAvailableDays("MON,TUE,WED,THU,FRI,SAT,SUN");
        doctor.setAvailableTime("00:00-00:00");
        doctor.setConsultationTime(15);
        doctor.setActive(true);

        when(doctorRepository.findById(1L)).thenReturn(Optional.of(doctor));
        when(doctorRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(doctor));
        when(doctorRepository.findAll()).thenReturn(List.of(doctor));

        when(appointmentRepository.saveAndFlush(any(Appointment.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(appointmentRepository.save(any(Appointment.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(appointmentRepository
                .findTop30ByDoctorIdAndStatusAndCalledAtIsNotNullAndCompletedAtIsNotNullOrderByCompletedAtDesc(
                        eq(1L), eq("COMPLETED")))
                .thenReturn(List.of());
        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByTokenNumber(any(), any()))
                .thenReturn(List.of());
    }

    private User patient(long id) {
        User user = new User();
        user.setId(id);
        user.setRole(Role.PATIENT);
        return user;
    }

    private Appointment booking(long id, long patientId, LocalDate date, LocalTime time, int token) {
        Appointment appointment = new Appointment();
        appointment.setId(id);
        appointment.setPatient(patient(patientId));
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(date);
        appointment.setAppointmentTime(time);
        appointment.setTokenNumber(token);
        appointment.setStatus("BOOKED");
        return appointment;
    }

    // ---------------- reschedule ----------------

    private final LocalDate nextWeek = LocalDate.now()
            .with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY))
            .plusWeeks(1);

    private Appointment mine;
    private Appointment someoneElse;

    private void sessionWithTwoBookings() {
        mine = booking(1L, 5L, nextWeek, LocalTime.of(10, 0), 1);
        someoneElse = booking(2L, 6L, nextWeek, LocalTime.of(10, 30), 2);

        when(appointmentRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), eq(nextWeek)))
                .thenReturn(List.of(mine, someoneElse));
        when(appointmentRepository
                .findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(5L))
                .thenReturn(List.of(mine));
    }

    @Test
    void rescheduleWithinSessionKeepsToken() {
        sessionWithTwoBookings();

        Appointment moved = service.rescheduleAppointment(
                1L, 5L, nextWeek, LocalTime.of(11, 0));

        assertEquals(LocalTime.of(11, 0), moved.getAppointmentTime());
        assertEquals(1, moved.getTokenNumber());
    }

    @Test
    void rescheduleIntoTakenSlotIsRefused() {
        sessionWithTwoBookings();

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () ->
                service.rescheduleAppointment(1L, 5L, nextWeek, LocalTime.of(10, 30)));

        assertTrue(error.getMessage().contains("already booked"));
    }

    @Test
    void cannotRescheduleSomeoneElsesAppointment() {
        sessionWithTwoBookings();

        assertThrows(IllegalArgumentException.class, () ->
                service.rescheduleAppointment(1L, 99L, nextWeek, LocalTime.of(11, 0)));
    }

    @Test
    void rescheduleOffTheGridIsRefused() {
        sessionWithTwoBookings();

        // 11:07 is not one of the 15-minute slots
        assertThrows(IllegalArgumentException.class, () ->
                service.rescheduleAppointment(1L, 5L, nextWeek, LocalTime.of(11, 7)));
    }

    // ---------------- check-in ----------------

    private Appointment soon(long minutesFromNow) {
        LocalDateTime slot = LocalDateTime.now().plusMinutes(minutesFromNow).withSecond(0).withNano(0);
        Appointment appointment = booking(3L, 5L, slot.toLocalDate(), slot.toLocalTime(), 1);
        when(appointmentRepository.findById(3L)).thenReturn(Optional.of(appointment));
        return appointment;
    }

    @Test
    void checkInArrived() {
        soon(30);

        Appointment result = service.checkIn(3L, 5L, "ARRIVED", null);

        assertEquals("ARRIVED", result.getArrivalStatus());
        assertNotNull(result.getCheckedInAt());
    }

    @Test
    void checkInLate() {
        soon(30);

        Appointment result = service.checkIn(3L, 5L, "LATE", 15);

        assertEquals("LATE", result.getArrivalStatus());
        assertEquals(15, result.getLateMinutes());
    }

    @Test
    void checkInTooEarlyOrBadValuesRefused() {
        soon(5 * 60);
        assertThrows(IllegalArgumentException.class, () -> service.checkIn(3L, 5L, "ARRIVED", null));

        soon(30);
        assertThrows(IllegalArgumentException.class, () -> service.checkIn(3L, 5L, "LATE", 2));
        assertThrows(IllegalArgumentException.class, () -> service.checkIn(3L, 99L, "ARRIVED", null));
    }

    // ---------------- late patient ahead pushes the estimate ----------------

    @Test
    void latePatientAheadDelaysMyEstimate() {
        LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);

        Appointment ahead = booking(10L, 6L, now.minusMinutes(10).toLocalDate(),
                now.minusMinutes(10).toLocalTime(), 1);
        ahead.setArrivalStatus("LATE");
        ahead.setCheckedInAt(LocalDateTime.now().minusMinutes(5));
        ahead.setLateMinutes(30);

        Appointment me = booking(11L, 5L, now.toLocalDate(), now.toLocalTime(), 2);

        when(appointmentRepository.findById(11L)).thenReturn(Optional.of(me));
        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), any()))
                .thenReturn(List.of(ahead, me));

        QueueStatusResponse status = service.getQueueStatus(11L);

        // Patient ahead arrives in ~25 min, then 15 min with the doctor
        long minutes = status.getEstimatedWaitingSeconds() / 60;
        assertTrue(minutes >= 38 && minutes <= 40, "waited " + minutes + " min");
        assertEquals(1, status.getPatientsAhead());
    }

    // ---------------- next free slot ----------------

    @Test
    void nextFreeSlotIsTheUpcomingSlot() {
        LocalDateTime now = LocalDateTime.now();

        List<NextSlotResponse> next = service.getNextFreeSlots();

        assertEquals(1, next.size());

        LocalDateTime slot = LocalDateTime.of(next.get(0).getDate(), next.get(0).getTime());

        assertTrue(slot.isAfter(now), "slot " + slot + " should be after " + now);
        assertTrue(slot.isBefore(now.plusMinutes(16)), "slot " + slot + " should be within 15 min");
    }
}
