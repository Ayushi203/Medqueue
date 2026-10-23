package com.medqueue.controller;

import com.medqueue.entity.Rating;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class RatingResponse {

    private Long id;
    private Long appointmentId;
    private LocalDate appointmentDate;

    private Long doctorId;
    private String doctorName;

    private Long patientId;
    private String patientName;

    private Integer stars;
    private String comment;
    private LocalDateTime createdAt;

    public RatingResponse() {
    }

    public RatingResponse(Rating rating) {
        this.id = rating.getId();
        this.appointmentId = rating.getAppointment().getId();
        this.appointmentDate = rating.getAppointment().getAppointmentDate();
        this.doctorId = rating.getDoctor().getId();
        this.doctorName = rating.getDoctor().getName();
        this.patientId = rating.getPatient().getId();
        this.patientName = rating.getPatient().getName();
        this.stars = rating.getStars();
        this.comment = rating.getComment();
        this.createdAt = rating.getCreatedAt();
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

    public Long getDoctorId() {
        return doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public Long getPatientId() {
        return patientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public Integer getStars() {
        return stars;
    }

    public String getComment() {
        return comment;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
