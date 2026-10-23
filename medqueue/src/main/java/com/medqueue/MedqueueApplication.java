package com.medqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class MedqueueApplication {

	public static void main(String[] args) {

		// "Now" must be clinic time, whatever zone the server runs in.
		// Matches medqueue.timezone in application.properties.
		String zone = System.getenv().getOrDefault("MEDQUEUE_TIMEZONE", "Asia/Kolkata");
		TimeZone.setDefault(TimeZone.getTimeZone(zone));

		SpringApplication.run(MedqueueApplication.class, args);
	}

}
