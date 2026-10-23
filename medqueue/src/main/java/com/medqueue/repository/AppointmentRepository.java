package com.medqueue.repository;

import com.medqueue.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface AppointmentRepository
        extends JpaRepository<Appointment, Long> {

    List<Appointment>
    findByDoctorIdAndAppointmentDateOrderByTokenNumber(
            Long doctorId,
            LocalDate appointmentDate
    );

    List<Appointment>
    findByPatientIdOrderByAppointmentDateDesc(
            Long patientId
    );

    List<Appointment>
    findByDoctorIdAndStatusAndCalledAtIsNotNullAndCompletedAtIsNotNull(
            Long doctorId,
            String status
    );

    long countByDoctorIdAndAppointmentDateAndStatus(
            Long doctorId,
            LocalDate appointmentDate,
            String status
    );

    boolean existsByDoctorIdAndPatientIdAndAppointmentDate(
            Long doctorId,
            Long patientId,
            LocalDate appointmentDate
    );

    List<Appointment>
    findByDoctorIdAndAppointmentDateAndAppointmentTime(
            Long doctorId,
            LocalDate appointmentDate,
            LocalTime appointmentTime
    );

    long countByStatus(String status);

    boolean existsByDoctorId(Long doctorId);

    List<Appointment> findByStatusIn(java.util.Collection<String> statuses);

    // Fill active_slot for live bookings saved before the column existed
    @Modifying
    @Query(value = "update appointments set active_slot = concat("
            + "doctor_id, '|', appointment_date, '|', time_format(appointment_time, '%H:%i')) "
            + "where status in ('BOOKED', 'CALLED') and active_slot is null",
            nativeQuery = true)
    int backfillActiveSlots();

    // Queue order: scheduled time first, then token for equal times
    List<Appointment>
    findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAscTokenNumberAsc(
            Long doctorId,
            LocalDate appointmentDate
    );

    // Most recent finished consultations, used to learn real consultation length
    List<Appointment>
    findTop30ByDoctorIdAndStatusAndCalledAtIsNotNullAndCompletedAtIsNotNullOrderByCompletedAtDesc(
            Long doctorId,
            String status
    );

    List<Appointment>
    findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(
            Long patientId
    );

    List<Appointment>
    findByDoctorIdAndAppointmentDateLessThanEqualOrderByAppointmentDateDescAppointmentTimeDesc(
            Long doctorId,
            LocalDate appointmentDate
    );
}