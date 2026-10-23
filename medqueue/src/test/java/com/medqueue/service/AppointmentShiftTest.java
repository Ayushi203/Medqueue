package com.medqueue.service;

import com.medqueue.controller.SlotResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Doctor;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.DoctorRepository;
import com.medqueue.repository.PrescriptionRepository;
import com.medqueue.repository.RatingRepository;
import com.medqueue.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Slot and queue rules for normal, midnight-ending and overnight shifts
class AppointmentShiftTest {

    private AppointmentRepository appointmentRepository;
    private DoctorRepository doctorRepository;
    private AppointmentService service;

    // A Monday at least a week away, so no slot is "already past"
    private final LocalDate monday = LocalDate.now()
            .with(TemporalAdjusters.next(DayOfWeek.MONDAY))
            .plusWeeks(1);

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

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByTokenNumber(any(), any()))
                .thenReturn(List.of());
    }

    private Doctor doctor(String days, String hours) {
        Doctor doctor = new Doctor();
        doctor.setId(1L);
        doctor.setName("Dr Test");
        doctor.setAvailableDays(days);
        doctor.setAvailableTime(hours);
        doctor.setConsultationTime(15);
        doctor.setActive(true);

        when(doctorRepository.findById(1L)).thenReturn(Optional.of(doctor));
        return doctor;
    }

    private List<String> slots(LocalDate date) {
        List<String> times = new ArrayList<>();

        for (SlotResponse slot : service.getSlots(1L, date)) {
            times.add(slot.getTime().toString());
        }

        return times;
    }

    @Test
    void dayShiftUnchanged() {
        doctor("MON,TUE,WED,THU,FRI", "10:00-14:00");

        List<String> monday = slots(this.monday);

        assertEquals(16, monday.size());
        assertEquals("10:00", monday.get(0));
        assertEquals("13:45", monday.get(15));
        assertEquals(List.of(), slots(this.monday.minusDays(1)));
    }

    @Test
    void shiftEndingAtMidnight() {
        doctor("MON,TUE,WED,THU,FRI", "18:00-00:00");

        List<String> monday = slots(this.monday);

        assertEquals(24, monday.size());
        assertEquals("18:00", monday.get(0));
        assertEquals("23:45", monday.get(23));
        // Nothing spills into Tuesday morning
        assertEquals("18:00", slots(this.monday.plusDays(1)).get(0));
    }

    @Test
    void overnightShiftSlotsSpanTwoDates() {
        doctor("MON,TUE,WED,THU,FRI", "23:00-03:00");

        // Monday: Sunday has no shift, so only Monday night's start
        assertEquals(List.of("23:00", "23:15", "23:30", "23:45"), slots(monday));

        // Tuesday: Monday night's early hours, then Tuesday night's start
        List<String> tuesday = slots(monday.plusDays(1));
        assertEquals(16, tuesday.size());
        assertEquals("00:00", tuesday.get(0));
        assertEquals("02:45", tuesday.get(11));
        assertEquals("23:00", tuesday.get(12));

        // Saturday: only the end of Friday night
        List<String> saturday = slots(monday.plusDays(5));
        assertEquals(12, saturday.size());
        assertEquals("02:45", saturday.get(11));

        // Sunday: nothing
        assertEquals(List.of(), slots(monday.plusDays(6)));
    }

    @Test
    void doctorQueueIsTheWholeNight() {
        Doctor doctor = doctor("MON,TUE,WED,THU,FRI", "23:00-03:00");
        LocalDate tuesday = monday.plusDays(1);

        Appointment previousNight = appointment(doctor, monday, "01:00", 1);
        Appointment mondayLate = appointment(doctor, monday, "23:30", 1);
        Appointment tuesdayEarly = appointment(doctor, tuesday, "01:00", 2);
        Appointment tuesdayLate = appointment(doctor, tuesday, "23:15", 1);

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), eq(monday)))
                .thenReturn(List.of(previousNight, mondayLate));

        when(appointmentRepository
                .findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(eq(1L), eq(tuesday)))
                .thenReturn(List.of(tuesdayEarly, tuesdayLate));

        List<Appointment> mondayNight = service.getDoctorQueue(1L, monday);

        // Monday night = Mon 23:30 then Tue 01:00, in that order
        assertEquals(List.of(mondayLate, tuesdayEarly), mondayNight);
    }

    private Appointment appointment(Doctor doctor, LocalDate date, String time, int token) {
        Appointment appointment = new Appointment();
        appointment.setId((long) (date.getDayOfYear() * 10000 + LocalTime.parse(time).toSecondOfDay() / 60));
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(date);
        appointment.setAppointmentTime(LocalTime.parse(time));
        appointment.setTokenNumber(token);
        appointment.setStatus("BOOKED");
        return appointment;
    }
}
