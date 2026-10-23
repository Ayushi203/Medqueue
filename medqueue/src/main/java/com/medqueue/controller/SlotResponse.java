package com.medqueue.controller;

import java.time.LocalTime;

public class SlotResponse {

    private LocalTime time;
    private boolean available;

    public SlotResponse() {
    }

    public SlotResponse(LocalTime time, boolean available) {
        this.time = time;
        this.available = available;
    }

    public LocalTime getTime() {
        return time;
    }

    public boolean isAvailable() {
        return available;
    }
}
