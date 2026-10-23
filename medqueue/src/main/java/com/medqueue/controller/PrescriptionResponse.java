package com.medqueue.controller;

import com.medqueue.entity.Appointment;
import com.medqueue.entity.Medicine;
import com.medqueue.entity.Prescription;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class PrescriptionResponse {

    private Long id;

    private Long appointmentId;
    private LocalDate appointmentDate;
    private LocalTime appointmentTime;
    private Integer tokenNumber;

    private Long patientId;
    private String patientName;

    private Long doctorId;
    private String doctorName;
    private String specialization;

    private String diagnosis;
    private List<Medicine> medicines;
    private String instructions;
    private LocalDate followUpDate;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public PrescriptionResponse() {
    }

    public PrescriptionResponse(Prescription prescription) {

        Appointment appointment = prescription.getAppointment();

        this.id = prescription.getId();

        this.appointmentId = appointment.getId();
        this.appointmentDate = appointment.getAppointmentDate();
        this.appointmentTime = appointment.getAppointmentTime();
        this.tokenNumber = appointment.getTokenNumber();

        this.patientId = appointment.getPatient().getId();
        this.patientName = appointment.getPatient().getName();

        this.doctorId = appointment.getDoctor().getId();
        this.doctorName = appointment.getDoctor().getName();
        this.specialization = appointment.getDoctor().getSpecialization();

        this.diagnosis = prescription.getDiagnosis();
        this.medicines = new ArrayList<>(prescription.getMedicines());
        this.instructions = prescription.getInstructions();
        this.followUpDate = prescription.getFollowUpDate();

        this.createdAt = prescription.getCreatedAt();
        this.updatedAt = prescription.getUpdatedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getAppointmentId() {
        return appointmentId;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public LocalTime getAppointmentTime() {
        return appointmentTime;
    }

    public Integer getTokenNumber() {
        return tokenNumber;
    }

    public Long getPatientId() {
        return patientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public String getSpecialization() {
        return specialization;
    }

    public String getDiagnosis() {
        return diagnosis;
    }

    public List<Medicine> getMedicines() {
        return medicines;
    }

    public String getInstructions() {
        return instructions;
    }

    public LocalDate getFollowUpDate() {
        return followUpDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
