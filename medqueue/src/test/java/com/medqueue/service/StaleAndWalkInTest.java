package com.medqueue.service;

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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StaleAndWalkInTest {

    private AppointmentRepository appointmentRepository;
    private UserRepository userRepository;
    private AppointmentService service;
    private Doctor doctor;

    @BeforeEach
    void setUp() {
        appointmentRepository = mock(AppointmentRepository.class);
        userRepository = mock(UserRepository.class);
        DoctorRepository doctorRepository = mock(DoctorRepository.class);

        service = new AppointmentService(
                appointmentRepository,
                userRepository,
                doctorRepository,
                mock(PrescriptionRepository.class),
                mock(RatingRepository.class));

        doctor = new Doctor();
        doctor.setId(1L);
        doctor.setAvailableDays("MON,TUE,WED,THU,FRI,SAT,SUN");
        doctor.setAvailableTime("00:00-00:00");
        doctor.setConsultationTime(15);
        doctor.setActive(true);

        when(doctorRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.save(any(Appointment.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(appointmentRepository.saveAndFlush(any(Appointment.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            user.setId(500L);
            return user;
        });
    }

    private Appointment at(long id, LocalDateTime slot, String status) {
        User patient = new User();
        patient.setId(id + 100);

        Appointment appointment = new Appointment();
        appointment.setId(id);
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(slot.toLocalDate());
        appointment.setAppointmentTime(slot.toLocalTime().withSecond(0).withNano(0));
        appointment.setTokenNumber((int) id);
        appointment.setStatus(status);
        return appointment;
    }

    // ---------------- auto-close ----------------

    @Test
    void staleAppointmentsAreClosedHonestly() {
        LocalDateTime now = LocalDateTime.now();

        Appointment oldBooked = at(1L, now.minusHours(13), "BOOKED");
        Appointment oldCalled = at(2L, now.minusHours(20), "CALLED");
        oldCalled.setCalledAt(now.minusHours(20));
        Appointment recent = at(3L, now.minusHours(2), "BOOKED");

        when(appointmentRepository.findByStatusIn(any()))
                .thenReturn(List.of(oldBooked, oldCalled, recent));

        int closed = service.closeStaleAppointments(now);

        assertEquals(2, closed);

        assertEquals("SKIPPED", oldBooked.getStatus());
        assertTrue(oldBooked.isAutoClosed());

        assertEquals("COMPLETED", oldCalled.getStatus());
        assertTrue(oldCalled.isAutoClosed());
        // Unknown finish time: kept empty so it can't distort the average
        assertNull(oldCalled.getCompletedAt());

        assertEquals("BOOKED", recent.getStatus());
        assertFalse(recent.isAutoClosed());
    }

    // ---------------- walk-ins ----------------

    @Test
    void walkInJoinsQueueCheckedIn() {
        Appointment booked = at(7L, LocalDateTime.now().plusMinutes(30), "BOOKED");

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), any()))
                .thenReturn(List.of(booked));
        when(userRepository.findFirstByPhoneAndRole("9876543210", Role.PATIENT))
                .thenReturn(Optional.empty());

        Appointment walkIn = service.addWalkIn(1L, "Ravi Kumar", "98765 43210");

        assertTrue(walkIn.isWalkIn());
        assertEquals("ARRIVED", walkIn.getArrivalStatus());
        assertEquals("BOOKED", walkIn.getStatus());
        assertEquals(8, walkIn.getTokenNumber());
        // Never on a booking slot's exact minute key
        assertNotEquals(0, walkIn.getAppointmentTime().getSecond());
        assertEquals("Ravi Kumar", walkIn.getPatient().getName());
        assertEquals("9876543210", walkIn.getPatient().getPhone());
    }

    @Test
    void walkInReusesPatientAndBlocksDuplicates() {
        User known = new User();
        known.setId(42L);
        known.setName("Ravi Kumar");
        known.setRole(Role.PATIENT);

        Appointment alreadyQueued = at(9L, LocalDateTime.now().plusMinutes(15), "BOOKED");
        alreadyQueued.setPatient(known);

        when(userRepository.findFirstByPhoneAndRole("9876543210", Role.PATIENT))
                .thenReturn(Optional.of(known));
        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), any()))
                .thenReturn(List.of(alreadyQueued));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () ->
                service.addWalkIn(1L, "Ravi Kumar", "9876543210"));

        assertTrue(error.getMessage().contains("already in today's queue"));
    }

    @Test
    void walkInOnlyDuringASession() {
        // Works only on a day that is neither today nor yesterday
        String offDay = LocalDateTime.now().plusDays(3).getDayOfWeek().name().substring(0, 3);
        doctor.setAvailableDays(offDay);

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), any()))
                .thenReturn(List.of());

        assertThrows(IllegalArgumentException.class, () ->
                service.addWalkIn(1L, "Ravi Kumar", null));
    }

    @Test
    void walkInNeedsAName() {
        assertThrows(IllegalArgumentException.class, () ->
                service.addWalkIn(1L, "  ", null));
    }
}
