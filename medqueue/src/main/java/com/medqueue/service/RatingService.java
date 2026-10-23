package com.medqueue.service;

import com.medqueue.controller.DoctorRatingSummary;
import com.medqueue.controller.RatingRequest;
import com.medqueue.controller.RatingResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Rating;
import com.medqueue.entity.User;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.RatingRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RatingService {

    private final RatingRepository ratingRepository;
    private final AppointmentRepository appointmentRepository;

    public RatingService(
            RatingRepository ratingRepository,
            AppointmentRepository appointmentRepository) {

        this.ratingRepository = ratingRepository;
        this.appointmentRepository = appointmentRepository;
    }

    // RATE A COMPLETED VISIT

    @Transactional
    public RatingResponse rateAppointment(
            Long appointmentId,
            User patient,
            RatingRequest request) {

        if (request == null || request.getStars() == null
                || request.getStars() < 1 || request.getStars() > 5) {
            throw new IllegalArgumentException(
                    "Rating must be between 1 and 5 stars");
        }

        String comment = request.getComment() == null
                ? null
                : request.getComment().trim();

        if (comment != null && comment.length() > 1000) {
            throw new IllegalArgumentException(
                    "Review must be 1000 characters or fewer");
        }

        Appointment appointment = appointmentRepository
                .findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Appointment not found"));

        if (!appointment.getPatient().getId().equals(patient.getId())) {
            throw new IllegalArgumentException(
                    "You can only rate your own appointments");
        }

        if (!"COMPLETED".equals(appointment.getStatus())) {
            throw new IllegalArgumentException(
                    "You can rate a doctor only after the consultation is completed");
        }

        if (ratingRepository.existsByAppointmentId(appointmentId)) {
            throw new IllegalArgumentException(
                    "You have already rated this visit");
        }

        Rating rating = new Rating();
        rating.setAppointment(appointment);
        rating.setDoctor(appointment.getDoctor());
        rating.setPatient(appointment.getPatient());
        rating.setStars(request.getStars());
        rating.setComment(comment == null || comment.isEmpty() ? null : comment);

        return new RatingResponse(ratingRepository.save(rating));
    }

    @Transactional(readOnly = true)
    public List<RatingResponse> getPatientRatings(Long patientId) {
        return ratingRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(RatingResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public DoctorRatingSummary getDoctorSummary(Long doctorId) {

        List<RatingResponse> reviews = ratingRepository
                .findByDoctorIdOrderByCreatedAtDesc(doctorId)
                .stream()
                .map(RatingResponse::new)
                .toList();

        double average = reviews.stream()
                .mapToInt(RatingResponse::getStars)
                .average()
                .orElse(0);

        return new DoctorRatingSummary(
                doctorId,
                round(average),
                (long) reviews.size(),
                reviews);
    }

    // doctorId -> [average, count], used to decorate the doctor list

    @Transactional(readOnly = true)
    public Map<Long, double[]> getAllDoctorAverages() {

        Map<Long, double[]> result = new HashMap<>();

        for (Object[] row : ratingRepository.summarizeByDoctor()) {
            Long doctorId = (Long) row[0];
            double average = ((Number) row[1]).doubleValue();
            long count = ((Number) row[2]).longValue();

            result.put(doctorId, new double[] { round(average), count });
        }

        return result;
    }

    private static double round(double value) {
        return Math.round(value * 10) / 10.0;
    }
}
