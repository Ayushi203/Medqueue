
package com.medqueue.controller;

public class AdminStatsResponse {

    private long totalDoctors;

    private long totalPatients;

    private long totalAppointments;

    private long bookedAppointments;

    private long completedAppointments;

    private long cancelledAppointments;

    private long skippedAppointments;

    private long calledAppointments;


    public AdminStatsResponse() {
    }


    public AdminStatsResponse(
            long totalDoctors,
            long totalPatients,
            long totalAppointments,
            long bookedAppointments,
            long completedAppointments,
            long cancelledAppointments,
            long skippedAppointments,
            long calledAppointments) {

        this.totalDoctors =
                totalDoctors;

        this.totalPatients =
                totalPatients;

        this.totalAppointments =
                totalAppointments;

        this.bookedAppointments =
                bookedAppointments;

        this.completedAppointments =
                completedAppointments;

        this.cancelledAppointments =
                cancelledAppointments;

        this.skippedAppointments =
                skippedAppointments;

        this.calledAppointments =
                calledAppointments;
    }


    public long getTotalDoctors() {
        return totalDoctors;
    }


    public long getTotalPatients() {
        return totalPatients;
    }


    public long getTotalAppointments() {
        return totalAppointments;
    }


    public long getBookedAppointments() {
        return bookedAppointments;
    }


    public long getCompletedAppointments() {
        return completedAppointments;
    }


    public long getCancelledAppointments() {
        return cancelledAppointments;
    }


    public long getSkippedAppointments() {
        return skippedAppointments;
    }


    public long getCalledAppointments() {
        return calledAppointments;
    }
}

