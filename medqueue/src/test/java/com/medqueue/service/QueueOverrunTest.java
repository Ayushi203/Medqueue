package com.medqueue.service;

import com.medqueue.controller.QueueStatusResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Doctor;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.PrescriptionRepository;
import com.medqueue.repository.RatingRepository;
import com.medqueue.repository.UserRepository;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Token 1 is with the doctor; token 2 is next. Usual length is 15 min.
class QueueOverrunTest {

    private QueueStatusResponse statusForNext(int token1MinutesInside) {

        AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);

        AppointmentService service = new AppointmentService(
                appointmentRepository,
                mock(UserRepository.class),
                mock(DoctorRepository.class),
                mock(PrescriptionRepository.class),
                mock(RatingRepository.class));

        Doctor doctor = new Doctor();
        doctor.setId(1L);
        doctor.setAvailableDays("MON,TUE,WED,THU,FRI,SAT,SUN");
        doctor.setAvailableTime("00:00-00:00");
        doctor.setConsultationTime(15);
        doctor.setActive(true);

        LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);
        LocalDateTime slot2 = now.minusMinutes(5);

        Appointment token1 = new Appointment();
        token1.setId(1L);
        token1.setDoctor(doctor);
        token1.setAppointmentDate(slot2.toLocalDate());
        token1.setAppointmentTime(slot2.toLocalTime().minusMinutes(15));
        token1.setTokenNumber(1);
        token1.setStatus("CALLED");
        token1.setCalledAt(LocalDateTime.now().minusMinutes(token1MinutesInside));

        Appointment token2 = new Appointment();
        token2.setId(2L);
        token2.setDoctor(doctor);
        token2.setAppointmentDate(slot2.toLocalDate());
        token2.setAppointmentTime(slot2.toLocalTime());
        token2.setTokenNumber(2);
        token2.setStatus("BOOKED");

        when(appointmentRepository.findById(2L)).thenReturn(Optional.of(token2));

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(
                        eq(1L), any()))
                .thenReturn(List.of(token1, token2));

        // No history: the learned average is the configured 15 minutes
        when(appointmentRepository
                .findTop30ByDoctorIdAndStatusAndCalledAtIsNotNullAndCompletedAtIsNotNullOrderByCompletedAtDesc(
                        eq(1L), eq("COMPLETED")))
                .thenReturn(List.of());

        return service.getQueueStatus(2L);
    }

    @Test
    void overrunningConsultationIsFlagged() {

        QueueStatusResponse status = statusForNext(20);

        assertTrue(status.getCurrentOverrunning());
        assertEquals(5, status.getCurrentOverrunMinutes());
        assertEquals(0, status.getPatientsAhead());
        assertEquals(1, status.getCurrentToken());
    }

    @Test
    void consultationWithinUsualTimeIsNotFlagged() {

        QueueStatusResponse status = statusForNext(10);

        assertFalse(status.getCurrentOverrunning());
        assertEquals(0, status.getCurrentOverrunMinutes());
        // About 5 minutes left for token 1, so token 2 waits roughly that long
        assertTrue(status.getEstimatedWaitingSeconds() >= 4 * 60
                && status.getEstimatedWaitingSeconds() <= 5 * 60);
    }
}
