package com.medqueue.config;

import com.medqueue.service.AppointmentService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

// Closes appointments nobody finished, shortly after startup and then every 30 minutes
@Component
public class StaleAppointmentCloser {

    private static final Logger log =
            LoggerFactory.getLogger(StaleAppointmentCloser.class);

    private final AppointmentService appointmentService;

    public StaleAppointmentCloser(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 30 * 60_000)
    public void closeStale() {

        try {
            int closed = appointmentService.closeStaleAppointments(LocalDateTime.now());

            if (closed > 0) {
                log.info("Auto-closed {} unfinished appointments", closed);
            }
        } catch (RuntimeException exception) {
            log.warn("Could not auto-close stale appointments: {}", exception.getMessage());
        }
    }
}
