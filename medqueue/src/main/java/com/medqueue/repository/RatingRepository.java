package com.medqueue.repository;

import com.medqueue.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RatingRepository
        extends JpaRepository<Rating, Long> {

    Optional<Rating> findByAppointmentId(Long appointmentId);

    boolean existsByAppointmentId(Long appointmentId);

    List<Rating> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);

    List<Rating> findByPatientIdOrderByCreatedAtDesc(Long patientId);

    List<Rating> findByAppointmentIdIn(Collection<Long> appointmentIds);

    // Rows of [doctorId, averageStars, ratingCount]
    @Query("select r.doctor.id, avg(r.stars), count(r) from Rating r "
            + "group by r.doctor.id")
    List<Object[]> summarizeByDoctor();

    @Query("select avg(r.stars), count(r) from Rating r "
            + "where r.doctor.id = :doctorId")
    List<Object[]> summarizeForDoctor(@Param("doctorId") Long doctorId);
}
