package com.medqueue.controller;

import java.time.LocalDate;
import java.time.LocalTime;

public class NextSlotResponse {

    private Long doctorId;
    private LocalDate date;
    private LocalTime time;

    public NextSlotResponse() {
    }

    public NextSlotResponse(Long doctorId, LocalDate date, LocalTime time) {
        this.doctorId = doctorId;
        this.date = date;
        this.time = time;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public LocalDate getDate() {
        return date;
    }

    public LocalTime getTime() {
        return time;
    }
}
