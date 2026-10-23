package com.medqueue.controller;

import java.time.LocalDateTime;

public class QueueStatusResponse {

    private Long appointmentId;

    private Integer tokenNumber;

    private Integer currentToken;

    private Integer patientsAhead;

    // Whole minutes, rounded up (kept for older clients)
    private Integer estimatedWaitingTime;

    // Exact remaining wait, so the client can run a live countdown
    private Long estimatedWaitingSeconds;

    // Estimated time the consultation will start
    private LocalDateTime estimatedArrivalTime;

    private Integer averageConsultationTime;

    private String status;

    // 1 = next to be called
    private Integer queuePosition;

    // When the patient currently with the doctor was called in
    private LocalDateTime currentConsultationStartedAt;

    // Minutes the estimate runs behind the booked slot (0 when on time)
    private Integer delayMinutes;

    // Number of past consultations the average is learned from
    private Integer basedOnConsultations;

    private LocalDateTime serverTime;

    // Patients ahead in today's order who are already done (completed or skipped)
    private Integer patientsServed;

    // Whether the doctor has called anyone for this day yet
    private Boolean doctorStarted;

    // The patient with the doctor has gone past the usual consultation length
    private Boolean currentOverrunning;

    // How many whole minutes past the usual length
    private Integer currentOverrunMinutes;

    public QueueStatusResponse() {
    }

    public Boolean getCurrentOverrunning() {
        return currentOverrunning;
    }

    public void setCurrentOverrunning(Boolean currentOverrunning) {
        this.currentOverrunning = currentOverrunning;
    }

    public Integer getCurrentOverrunMinutes() {
        return currentOverrunMinutes;
    }

    public void setCurrentOverrunMinutes(Integer currentOverrunMinutes) {
        this.currentOverrunMinutes = currentOverrunMinutes;
    }

    public Integer getPatientsServed() {
        return patientsServed;
    }

    public void setPatientsServed(Integer patientsServed) {
        this.patientsServed = patientsServed;
    }

    public Boolean getDoctorStarted() {
        return doctorStarted;
    }

    public void setDoctorStarted(Boolean doctorStarted) {
        this.doctorStarted = doctorStarted;
    }

    public QueueStatusResponse(
            Long appointmentId,
            Integer tokenNumber,
            Integer currentToken,
            Integer patientsAhead,
            Long estimatedWaitingSeconds,
            LocalDateTime estimatedArrivalTime,
            Integer averageConsultationTime,
            String status,
            Integer queuePosition,
            LocalDateTime currentConsultationStartedAt,
            Integer delayMinutes,
            Integer basedOnConsultations,
            LocalDateTime serverTime) {

        this.appointmentId = appointmentId;
        this.tokenNumber = tokenNumber;
        this.currentToken = currentToken;
        this.patientsAhead = patientsAhead;
        this.estimatedWaitingSeconds = estimatedWaitingSeconds;
        this.estimatedWaitingTime =
                (int) Math.ceil(estimatedWaitingSeconds / 60.0);
        this.estimatedArrivalTime = estimatedArrivalTime;
        this.averageConsultationTime = averageConsultationTime;
        this.status = status;
        this.queuePosition = queuePosition;
        this.currentConsultationStartedAt = currentConsultationStartedAt;
        this.delayMinutes = delayMinutes;
        this.basedOnConsultations = basedOnConsultations;
        this.serverTime = serverTime;
    }

    public Long getAppointmentId() {
        return appointmentId;
    }

    public Integer getTokenNumber() {
        return tokenNumber;
    }

    public Integer getCurrentToken() {
        return currentToken;
    }

    public Integer getPatientsAhead() {
        return patientsAhead;
    }

    public Integer getEstimatedWaitingTime() {
        return estimatedWaitingTime;
    }

    public Long getEstimatedWaitingSeconds() {
        return estimatedWaitingSeconds;
    }

    public LocalDateTime getEstimatedArrivalTime() {
        return estimatedArrivalTime;
    }

    public Integer getAverageConsultationTime() {
        return averageConsultationTime;
    }

    public String getStatus() {
        return status;
    }

    public Integer getQueuePosition() {
        return queuePosition;
    }

    public LocalDateTime getCurrentConsultationStartedAt() {
        return currentConsultationStartedAt;
    }

    public Integer getDelayMinutes() {
        return delayMinutes;
    }

    public Integer getBasedOnConsultations() {
        return basedOnConsultations;
    }

    public LocalDateTime getServerTime() {
        return serverTime;
    }
}
