package com.medqueue.controller;

import com.medqueue.entity.Medicine;
import com.medqueue.entity.PrescriptionTemplate;
import com.medqueue.repository.PrescriptionTemplateRepository;
import com.medqueue.service.CurrentUserService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

// The logged-in doctor's own prescription templates
@RestController
@RequestMapping("/api/prescription-templates")
@PreAuthorize("hasRole('DOCTOR')")
public class PrescriptionTemplateController {

    private static final int MAX_TEMPLATES = 50;

    private final PrescriptionTemplateRepository templateRepository;
    private final CurrentUserService currentUserService;

    public PrescriptionTemplateController(
            PrescriptionTemplateRepository templateRepository,
            CurrentUserService currentUserService) {

        this.templateRepository = templateRepository;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<PrescriptionTemplate>> getMyTemplates(
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        List<PrescriptionTemplate> templates =
                templateRepository.findByDoctorIdOrderByNameAsc(doctorId);

        // Load medicines while the transaction is open
        templates.forEach(template -> template.getMedicines().size());

        return ResponseEntity.ok(templates);
    }

    // Saving with an existing name replaces that template
    @PostMapping
    @Transactional
    public ResponseEntity<PrescriptionTemplate> saveTemplate(
            @RequestBody PrescriptionTemplate request,
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        String name = request.getName() == null ? "" : request.getName().trim();

        if (name.isEmpty() || name.length() > 80) {
            throw new IllegalArgumentException(
                    "Template name is required (up to 80 characters)");
        }

        List<Medicine> medicines = new ArrayList<>();

        if (request.getMedicines() != null) {
            for (Medicine medicine : request.getMedicines()) {
                if (medicine != null && medicine.getName() != null
                        && !medicine.getName().trim().isEmpty()) {
                    medicines.add(new Medicine(
                            medicine.getName().trim(),
                            medicine.getDosage(),
                            medicine.getFrequency(),
                            medicine.getDuration(),
                            medicine.getInstructions()));
                }
            }
        }

        if (medicines.isEmpty()) {
            throw new IllegalArgumentException(
                    "A template needs at least one medicine");
        }

        PrescriptionTemplate template = templateRepository
                .findByDoctorIdAndNameIgnoreCase(doctorId, name)
                .orElseGet(() -> {

                    if (templateRepository.findByDoctorIdOrderByNameAsc(doctorId).size()
                            >= MAX_TEMPLATES) {
                        throw new IllegalArgumentException(
                                "You can save up to " + MAX_TEMPLATES + " templates");
                    }

                    PrescriptionTemplate created = new PrescriptionTemplate();
                    created.setDoctorId(doctorId);
                    return created;
                });

        template.setName(name);
        template.setDiagnosis(request.getDiagnosis());
        template.setInstructions(request.getInstructions());
        template.getMedicines().clear();
        template.getMedicines().addAll(medicines);

        return ResponseEntity.ok(templateRepository.save(template));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteTemplate(
            @PathVariable Long id,
            Authentication authentication) {

        Long doctorId = currentUserService.getDoctor(authentication).getId();

        PrescriptionTemplate template = templateRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Template not found"));

        if (!template.getDoctorId().equals(doctorId)) {
            throw new AccessDeniedException("This is not your template");
        }

        templateRepository.delete(template);

        return ResponseEntity.noContent().build();
    }
}
