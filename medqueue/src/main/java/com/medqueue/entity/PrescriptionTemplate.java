package com.medqueue.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// A doctor's saved prescription (e.g. "Viral fever") to fill the form quickly
@Entity
@Table(
    name = "prescription_templates",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_template_doctor_name",
        columnNames = { "doctor_id", "name" }
    )
)
public class PrescriptionTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doctor_id", nullable = false)
    private Long doctorId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 1000)
    private String diagnosis;

    @ElementCollection
    @CollectionTable(
        name = "prescription_template_medicines",
        joinColumns = @JoinColumn(name = "template_id")
    )
    private List<Medicine> medicines = new ArrayList<>();

    @Column(length = 2000)
    private String instructions;

    private LocalDateTime updatedAt;

    public PrescriptionTemplate() {
    }

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDiagnosis() {
        return diagnosis;
    }

    public void setDiagnosis(String diagnosis) {
        this.diagnosis = diagnosis;
    }

    public List<Medicine> getMedicines() {
        return medicines;
    }

    public void setMedicines(List<Medicine> medicines) {
        this.medicines = medicines;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
