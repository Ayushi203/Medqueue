
package com.medqueue.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "doctors")
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String specialization;

    private String phone;

    private String email;

    @Column(name = "consultation_time")
    private Integer consultationTime;

    private String availableDays;

    private String availableTime;

    @Column(name = "user_id")
    private Long userId;

    // Deactivated doctors keep their history but cannot log in or be booked.
    // Null (rows created before this column) counts as active.
    @Column(name = "active")
    private Boolean active = true;

    public boolean getActive() {
        return !Boolean.FALSE.equals(active);
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    // Filled from ratings when doctors are listed; not stored
    @Transient
    private Double averageRating;

    @Transient
    private Long ratingCount;

    // Learned average consultation minutes; only filled for the doctor's own profile
    @Transient
    private Integer learnedConsultationMinutes;

    public Integer getLearnedConsultationMinutes() {
        return learnedConsultationMinutes;
    }

    public void setLearnedConsultationMinutes(Integer learnedConsultationMinutes) {
        this.learnedConsultationMinutes = learnedConsultationMinutes;
    }

    public Doctor() {
    }

    public Double getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(Double averageRating) {
        this.averageRating = averageRating;
    }

    public Long getRatingCount() {
        return ratingCount;
    }

    public void setRatingCount(Long ratingCount) {
        this.ratingCount = ratingCount;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Integer getConsultationTime() {
        return consultationTime;
    }

    public void setConsultationTime(Integer consultationTime) {
        this.consultationTime = consultationTime;
    }

    public String getAvailableDays() {
        return availableDays;
    }

    public void setAvailableDays(String availableDays) {
        this.availableDays = availableDays;
    }

    public String getAvailableTime() {
        return availableTime;
    }

    public void setAvailableTime(String availableTime) {
        this.availableTime = availableTime;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
}

