package com.medqueue.controller;

import java.util.List;

public class DoctorRatingSummary {

    private Long doctorId;
    private Double averageRating;
    private Long ratingCount;
    private List<RatingResponse> reviews;

    public DoctorRatingSummary() {
    }

    public DoctorRatingSummary(
            Long doctorId,
            Double averageRating,
            Long ratingCount,
            List<RatingResponse> reviews) {

        this.doctorId = doctorId;
        this.averageRating = averageRating;
        this.ratingCount = ratingCount;
        this.reviews = reviews;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public Double getAverageRating() {
        return averageRating;
    }

    public Long getRatingCount() {
        return ratingCount;
    }

    public List<RatingResponse> getReviews() {
        return reviews;
    }
}
