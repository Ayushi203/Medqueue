package com.medqueue.config;

import com.medqueue.repository.AppointmentRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Gives bookings made before the active_slot column existed their slot key,
// so the unique key protects them too. Safe to run on every startup.
@Component
public class ActiveSlotBackfill implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(ActiveSlotBackfill.class);

    private final AppointmentRepository appointmentRepository;

    public ActiveSlotBackfill(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {

        try {
            int updated = appointmentRepository.backfillActiveSlots();

            if (updated > 0) {
                log.info("Filled active slot for {} existing bookings", updated);
            }
        } catch (RuntimeException exception) {
            log.warn("Could not fill active slots (duplicate live bookings?): {}",
                    exception.getMessage());
        }
    }
}
