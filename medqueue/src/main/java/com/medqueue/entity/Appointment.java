package com.medqueue.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(
    name = "appointments",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_appointment_active_slot",
        columnNames = "active_slot"
    )
)
public class Appointment {

    // "doctorId|date|time" while the booking holds its slot (BOOKED or CALLED),
    // otherwise null. The unique key stops two live bookings sharing a slot,
    // while cancelled/finished rows (null) never block anyone.
    @Column(name = "active_slot", length = 64)
    private String activeSlot;

    @PrePersist
    @PreUpdate
    protected void syncActiveSlot() {
        activeSlot = slotKey();
    }

    public String slotKey() {

        boolean holdsSlot = "BOOKED".equals(status) || "CALLED".equals(status);

        if (!holdsSlot || doctor == null
                || appointmentDate == null || appointmentTime == null) {
            return null;
        }

        return doctor.getId() + "|" + appointmentDate + "|" + appointmentTime;
    }

    public String getActiveSlot() {
        return activeSlot;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(nullable = false)
    private LocalDate appointmentDate;

    @Column(nullable = false)
    private LocalTime appointmentTime;

    @Column(nullable = false)
    private Integer tokenNumber;

    @Column(nullable = false)
    private String status;

    @Column(name = "called_at")
    private LocalDateTime calledAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // Closed by the system because nobody finished it (see StaleAppointmentCloser)
    @Column(name = "auto_closed")
    private Boolean autoClosed;

    // Added at the clinic by the doctor, not booked online
    @Column(name = "walk_in")
    private Boolean walkIn;

    public boolean isAutoClosed() {
        return Boolean.TRUE.equals(autoClosed);
    }

    public void setAutoClosed(Boolean autoClosed) {
        this.autoClosed = autoClosed;
    }

    public boolean isWalkIn() {
        return Boolean.TRUE.equals(walkIn);
    }

    public void setWalkIn(Boolean walkIn) {
        this.walkIn = walkIn;
    }

    // Patient check-in: ARRIVED, LATE, or null (no word yet)
    @Column(name = "arrival_status", length = 16)
    private String arrivalStatus;

    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;

    // Only for LATE: how many minutes late the patient said they would be
    @Column(name = "late_minutes")
    private Integer lateMinutes;

    public String getArrivalStatus() {
        return arrivalStatus;
    }

    public void setArrivalStatus(String arrivalStatus) {
        this.arrivalStatus = arrivalStatus;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public void setCheckedInAt(LocalDateTime checkedInAt) {
        this.checkedInAt = checkedInAt;
    }

    public Integer getLateMinutes() {
        return lateMinutes;
    }

    public void setLateMinutes(Integer lateMinutes) {
        this.lateMinutes = lateMinutes;
    }

    // When the patient can be seen: their slot, or later if they said they're late
    public LocalDateTime availableFrom() {

        LocalDateTime slot = LocalDateTime.of(appointmentDate, appointmentTime);

        if ("LATE".equals(arrivalStatus) && checkedInAt != null && lateMinutes != null) {
            LocalDateTime eta = checkedInAt.plusMinutes(lateMinutes);
            return eta.isAfter(slot) ? eta : slot;
        }

        return slot;
    }

    public Appointment() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getPatient() {
        return patient;
    }

    public void setPatient(User patient) {
        this.patient = patient;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(LocalDate appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public LocalTime getAppointmentTime() {
        return appointmentTime;
    }

    public void setAppointmentTime(LocalTime appointmentTime) {
        this.appointmentTime = appointmentTime;
    }

    public Integer getTokenNumber() {
        return tokenNumber;
    }

    public void setTokenNumber(Integer tokenNumber) {
        this.tokenNumber = tokenNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCalledAt() {
        return calledAt;
    }

    public void setCalledAt(LocalDateTime calledAt) {
        this.calledAt = calledAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}