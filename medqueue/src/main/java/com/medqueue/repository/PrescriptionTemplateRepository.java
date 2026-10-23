package com.medqueue.repository;

import com.medqueue.entity.PrescriptionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrescriptionTemplateRepository
        extends JpaRepository<PrescriptionTemplate, Long> {

    List<PrescriptionTemplate> findByDoctorIdOrderByNameAsc(Long doctorId);

    Optional<PrescriptionTemplate> findByDoctorIdAndNameIgnoreCase(Long doctorId, String name);
}
