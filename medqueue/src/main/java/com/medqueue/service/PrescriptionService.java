
package com.medqueue.service;

import com.medqueue.controller.PrescriptionResponse;
import com.medqueue.entity.Appointment;
import com.medqueue.entity.Medicine;
import com.medqueue.entity.Prescription;
import com.medqueue.repository.AppointmentRepository;
import com.medqueue.repository.PrescriptionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final AppointmentRepository appointmentRepository;

    public PrescriptionService(
            PrescriptionRepository prescriptionRepository,
            AppointmentRepository appointmentRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.appointmentRepository = appointmentRepository;
    }

    // CREATE PRESCRIPTION (during or after the consultation)

    @Transactional
    public PrescriptionResponse createPrescription(
            Long appointmentId,
            Long doctorId,
            Prescription prescription) {

        validate(prescription);

        Appointment appointment = getDoctorAppointment(appointmentId, doctorId);

        String status = appointment.getStatus();

        if (!"CALLED".equalsIgnoreCase(status)
                && !"COMPLETED".equalsIgnoreCase(status)) {
            throw new IllegalStateException(
                    "Prescription can only be written during or after the consultation");
        }

        if (prescriptionRepository
                .findByAppointmentId(appointmentId).isPresent()) {
            throw new IllegalStateException(
                    "A prescription already exists for this appointment");
        }

        prescription.setId(null);
        prescription.setAppointment(appointment);
        prescription.setMedicines(cleanMedicines(prescription.getMedicines()));

        return new PrescriptionResponse(
                prescriptionRepository.save(prescription));
    }

    // UPDATE PRESCRIPTION

    @Transactional
    public PrescriptionResponse updatePrescription(
            Long appointmentId,
            Long doctorId,
            Prescription updated) {

        validate(updated);

        getDoctorAppointment(appointmentId, doctorId);

        Prescription prescription = prescriptionRepository
                .findByAppointmentId(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Prescription not found"));

        prescription.setDiagnosis(updated.getDiagnosis().trim());
        prescription.getMedicines().clear();
        prescription.getMedicines().addAll(cleanMedicines(updated.getMedicines()));
        prescription.setInstructions(updated.getInstructions());
        prescription.setFollowUpDate(updated.getFollowUpDate());

        return new PrescriptionResponse(
                prescriptionRepository.save(prescription));
    }

    @Transactional(readOnly = true)
    public Optional<PrescriptionResponse> getByAppointmentId(
            Long appointmentId) {
        return prescriptionRepository.findByAppointmentId(appointmentId)
                .map(PrescriptionResponse::new);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> getPatientPrescriptions(
            Long patientId) {
        return prescriptionRepository
                .findByAppointmentPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(PrescriptionResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> getDoctorPrescriptions(
            Long doctorId) {
        return prescriptionRepository
                .findByAppointmentDoctorIdOrderByCreatedAtDesc(doctorId)
                .stream()
                .map(PrescriptionResponse::new)
                .toList();
    }

    // HELPERS

    private Appointment getDoctorAppointment(
            Long appointmentId,
            Long doctorId) {

        Appointment appointment = appointmentRepository
                .findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Appointment not found"));

        if (appointment.getDoctor() == null
                || !appointment.getDoctor().getId().equals(doctorId)) {
            throw new IllegalArgumentException(
                    "This appointment does not belong to you");
        }

        return appointment;
    }

    private void validate(Prescription prescription) {

        if (prescription == null) {
            throw new IllegalArgumentException(
                    "Prescription data is required");
        }

        if (prescription.getDiagnosis() == null
                || prescription.getDiagnosis().trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Diagnosis is required");
        }

        if (prescription.getMedicines() == null
                || prescription.getMedicines().isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one medicine is required");
        }

        boolean hasInvalidMedicine = prescription.getMedicines()
                .stream()
                .anyMatch(medicine ->
                        medicine == null
                        || medicine.getName() == null
                        || medicine.getName().trim().isEmpty());

        if (hasInvalidMedicine) {
            throw new IllegalArgumentException(
                    "Every medicine must have a name");
        }
    }

    private List<Medicine> cleanMedicines(List<Medicine> medicines) {

        List<Medicine> cleaned = new ArrayList<>();

        for (Medicine medicine : medicines) {
            cleaned.add(new Medicine(
                    medicine.getName().trim(),
                    medicine.getDosage(),
                    medicine.getFrequency(),
                    medicine.getDuration(),
                    medicine.getInstructions()));
        }

        return cleaned;
    }
}
