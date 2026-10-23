
package com.medqueue.repository;

import com.medqueue.entity.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PrescriptionRepository
        extends JpaRepository<Prescription, Long> {

    Optional<Prescription> findByAppointmentId(Long appointmentId);

    List<Prescription> findByAppointmentPatientIdOrderByCreatedAtDesc(
            Long patientId
    );

    List<Prescription> findByAppointmentDoctorIdOrderByCreatedAtDesc(
            Long doctorId
    );

    List<Prescription> findByAppointmentIdIn(
            Collection<Long> appointmentIds
    );

    @Query("select p.appointment.id from Prescription p "
            + "where p.appointment.id in :appointmentIds")
    List<Long> findAppointmentIdsWithPrescription(
            @Param("appointmentIds") Collection<Long> appointmentIds
    );
}
