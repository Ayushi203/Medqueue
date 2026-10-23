package com.medqueue.controller;

import com.medqueue.entity.Appointment;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class AppointmentResponse {

    private Long id;

    private Long patientId;
    private String patientName;
    private String patientEmail;
    private String patientPhone;

    private Long doctorId;
    private String doctorName;
    private String specialization;

    private LocalDate appointmentDate;
    private LocalTime appointmentTime;

    private Integer tokenNumber;

    private String status;

    private LocalDateTime calledAt;
    private LocalDateTime completedAt;

    // Visit details, filled in for queue and history views
    private Long consultationMinutes;
    private PrescriptionResponse prescription;
    private RatingResponse rating;

    private boolean autoClosed;
    private boolean walkIn;

    public boolean isAutoClosed() {
        return autoClosed;
    }

    public boolean isWalkIn() {
        return walkIn;
    }

    // Check-in
    private String arrivalStatus;
    private LocalDateTime checkedInAt;
    private Integer lateMinutes;

    public String getArrivalStatus() {
        return arrivalStatus;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public Integer getLateMinutes() {
        return lateMinutes;
    }

    public AppointmentResponse() {
    }

    public AppointmentResponse(Appointment appointment) {

        this.id = appointment.getId();

        this.patientId =
                appointment.getPatient().getId();

        this.patientName =
                appointment.getPatient().getName();

        this.patientEmail =
                appointment.getPatient().getEmail();

        this.patientPhone =
                appointment.getPatient().getPhone();

        this.doctorId =
                appointment.getDoctor().getId();

        this.doctorName =
                appointment.getDoctor().getName();

        this.specialization =
                appointment.getDoctor().getSpecialization();

        this.appointmentDate =
                appointment.getAppointmentDate();

        this.appointmentTime =
                appointment.getAppointmentTime();

        this.tokenNumber =
                appointment.getTokenNumber();

        this.status =
                appointment.getStatus();

        this.calledAt =
                appointment.getCalledAt();

        this.completedAt =
                appointment.getCompletedAt();

        this.autoClosed = appointment.isAutoClosed();
        this.walkIn = appointment.isWalkIn();
        this.arrivalStatus = appointment.getArrivalStatus();
        this.checkedInAt = appointment.getCheckedInAt();
        this.lateMinutes = appointment.getLateMinutes();

        if (appointment.getCalledAt() != null
                && appointment.getCompletedAt() != null
                && "COMPLETED".equals(appointment.getStatus())) {

            this.consultationMinutes = Math.max(1, Duration.between(
                    appointment.getCalledAt(),
                    appointment.getCompletedAt()).toMinutes());
        }
    }

    public Long getConsultationMinutes() {
        return consultationMinutes;
    }

    public PrescriptionResponse getPrescription() {
        return prescription;
    }

    public void setPrescription(PrescriptionResponse prescription) {
        this.prescription = prescription;
    }

    public boolean isHasPrescription() {
        return prescription != null;
    }

    public RatingResponse getRating() {
        return rating;
    }

    public void setRating(RatingResponse rating) {
        this.rating = rating;
    }

    public Long getId() {
        return id;
    }

    public Long getPatientId() {
        return patientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public String getPatientEmail() {
        return patientEmail;
    }

    public String getPatientPhone() {
        return patientPhone;
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

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public LocalTime getAppointmentTime() {
        return appointmentTime;
    }

    public Integer getTokenNumber() {
        return tokenNumber;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCalledAt() {
        return calledAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
}