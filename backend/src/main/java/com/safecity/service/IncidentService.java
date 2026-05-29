package com.safecity.service;

import com.safecity.domain.AuditActionType;
import com.safecity.domain.Incident;
import com.safecity.domain.IncidentCategory;
import com.safecity.domain.IncidentStatus;
import com.safecity.dto.IncidentRequest;
import com.safecity.dto.IncidentResponse;
import com.safecity.dto.RateRequest;
import com.safecity.dto.RejectRequest;
import com.safecity.dto.AssignDepartmentRequest;
import com.safecity.dto.ReviewFixRequest;
import com.safecity.dto.StatusUpdateRequest;
import com.safecity.exception.ResourceNotFoundException;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final GamificationService gamificationService;
    private final AiAnalysisService aiAnalysisService;
    private final EmailNotificationService emailNotificationService;
    private final IncidentAuditService auditService;
    private final DuplicateDetectionService duplicateDetectionService;

    private static final String UPLOAD_DIR = "uploads/incidents/";

    @Value("${safecity.sla.hours:72}")
    private int slaHours;

    @Transactional
    public IncidentResponse createIncident(
        IncidentRequest request,
        MultipartFile photo,
        String keycloakId,
        String username,
        String reporterEmail
    ) {
        String photoPath = null;
        if (photo != null && !photo.isEmpty()) {
            photoPath = storePhoto(photo);
        }

        double lat = request.getLatitude() != null ? request.getLatitude() : 37.2744;
        double lng = request.getLongitude() != null ? request.getLongitude() : 9.8739;

        Long duplicateId = null;
        if (request.getCategory() != null) {
            duplicateId = duplicateDetectionService.findFirstDuplicateId(lat, lng, request.getCategory());
        }

        Incident incident = Incident.builder()
            .reporterKeycloakId(keycloakId)
            .reporterUsername(username)
            .reporterEmail(reporterEmail)
            .title(request.getTitle())
            .description(request.getDescription())
            .latitude(lat)
            .longitude(lng)
            .address(request.getAddress())
            .category(request.getCategory())
            .photoPath(photoPath)
            .status(IncidentStatus.PENDING)
            .duplicateOfIncidentId(duplicateId)
            .build();

        if (photoPath != null && photo != null) {
            var aiResult = aiAnalysisService.analyze(photo);
            incident.setAiCategory(aiResult.getCategory());
            incident.setAiConfidence(aiResult.getConfidence());
        }

        Incident saved = incidentRepository.save(Objects.requireNonNull(incident));
        auditService.log(saved.getId(), AuditActionType.CREATED, null, IncidentStatus.PENDING.name(),
            keycloakId, username, "Incident reported");
        if (duplicateId != null) {
            auditService.log(saved.getId(), AuditActionType.DUPLICATE_LINKED, null, String.valueOf(duplicateId),
                keycloakId, username, "Possible duplicate of #" + duplicateId);
        }
        log.info("Incident created id={} by user={}", saved.getId(), username);
        try {
            emailNotificationService.sendNewIncidentAlert(saved);
        } catch (Exception e) {
            log.warn("Failed to send new incident alert: {}", e.getMessage());
        }
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public IncidentResponse getById(@NonNull Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public Page<IncidentResponse> getAll(@NonNull Pageable pageable) {
        return incidentRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<IncidentResponse> getMyIncidents(String keycloakId, @NonNull Pageable pageable) {
        return incidentRepository.findByReporterKeycloakId(keycloakId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<IncidentResponse> getDepartmentIncidents(String department, @NonNull Pageable pageable) {
        if (department == null || department.isBlank()) {
            return incidentRepository.findByAssignedDepartmentIsNotNull(pageable).map(this::toResponse);
        }
        return incidentRepository.findByAssignedDepartmentIgnoreCase(department.trim(), pageable).map(this::toResponse);
    }

    @Transactional
    public IncidentResponse updateStatus(@NonNull Long id, StatusUpdateRequest request, String adminId, String adminUsername) {
        Incident incident = findOrThrow(id);
        IncidentStatus previousStatus = incident.getStatus();
        IncidentStatus newStatus = request.getStatus();

        incident.setStatus(newStatus);

        if (newStatus == IncidentStatus.VALIDATED && previousStatus != IncidentStatus.VALIDATED) {
            incident.setValidatedAt(LocalDateTime.now());
            incident.setSlaDeadlineAt(LocalDateTime.now().plusHours(slaHours));
            gamificationService.awardValidationPoints(
                incident.getReporterKeycloakId(),
                incident.getReporterUsername(),
                incident.getId()
            );
            auditService.log(id, AuditActionType.SLA_SET, null, incident.getSlaDeadlineAt().toString(),
                adminId, adminUsername, "SLA deadline set (" + slaHours + "h)");
        }
        if (newStatus == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(LocalDateTime.now());
        }

        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.STATUS_CHANGED, previousStatus.name(), newStatus.name(),
            adminId, adminUsername, null);
        emailNotificationService.sendIncidentStatusChange(saved, previousStatus);
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse assignDepartment(
        @NonNull Long id,
        AssignDepartmentRequest request,
        String adminId,
        String adminUsername
    ) {
        Incident incident = findOrThrow(id);
        IncidentStatus previousStatus = incident.getStatus();
        String department = request.getDepartment().trim();

        incident.setAssignedDepartment(department);
        incident.setDepartmentAssignedAt(LocalDateTime.now());
        incident.setDepartmentReviewReason(null);
        incident.setDepartmentFixPhotoPath(null);
        incident.setDepartmentFixSubmittedAt(null);
        incident.setStatus(IncidentStatus.ASSIGNED);

        Incident saved = incidentRepository.save(incident);
        String note = request.getNote() == null || request.getNote().isBlank()
            ? "Assigned to " + department
            : "Assigned to " + department + ": " + request.getNote().trim();
        auditService.log(id, AuditActionType.ASSIGNED, previousStatus.name(), IncidentStatus.ASSIGNED.name(),
            adminId, adminUsername, note);
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse submitDepartmentFix(
        @NonNull Long id,
        MultipartFile photo,
        String department,
        String userId,
        String username
    ) {
        Incident incident = findOrThrow(id);
        if (incident.getAssignedDepartment() == null || incident.getAssignedDepartment().isBlank()) {
            throw new IllegalStateException("Incident is not assigned to a department");
        }
        if (department != null && !department.isBlank()
            && !incident.getAssignedDepartment().equalsIgnoreCase(department.trim())) {
            throw new AccessDeniedException("This incident is assigned to another department");
        }
        if (photo == null || photo.isEmpty()) {
            throw new IllegalArgumentException("Fix photo is required");
        }

        IncidentStatus previousStatus = incident.getStatus();
        incident.setDepartmentFixPhotoPath(storePhoto(photo));
        incident.setDepartmentFixSubmittedAt(LocalDateTime.now());
        incident.setDepartmentReviewReason(null);
        incident.setStatus(IncidentStatus.FIX_SUBMITTED);

        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.FIX_SUBMITTED, previousStatus.name(), IncidentStatus.FIX_SUBMITTED.name(),
            userId, username, "Fix photo submitted by " + incident.getAssignedDepartment());
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse approveDepartmentFix(@NonNull Long id, String adminId, String adminUsername) {
        Incident incident = findOrThrow(id);
        if (incident.getStatus() != IncidentStatus.FIX_SUBMITTED) {
            throw new IllegalStateException("Only submitted fixes can be approved");
        }

        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.RESOLVED);
        incident.setResolvedAt(LocalDateTime.now());
        incident.setDepartmentReviewReason(null);

        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.FIX_APPROVED, previousStatus.name(), IncidentStatus.RESOLVED.name(),
            adminId, adminUsername, "Department fix approved");
        emailNotificationService.sendIncidentStatusChange(saved, previousStatus);
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse refuseDepartmentFix(
        @NonNull Long id,
        ReviewFixRequest request,
        String adminId,
        String adminUsername
    ) {
        Incident incident = findOrThrow(id);
        if (incident.getStatus() != IncidentStatus.FIX_SUBMITTED) {
            throw new IllegalStateException("Only submitted fixes can be refused");
        }

        IncidentStatus previousStatus = incident.getStatus();
        String reason = request.getReason().trim();
        incident.setStatus(IncidentStatus.ASSIGNED);
        incident.setDepartmentReviewReason(reason);

        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.FIX_REFUSED, previousStatus.name(), IncidentStatus.ASSIGNED.name(),
            adminId, adminUsername, reason);
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse reject(@NonNull Long id, RejectRequest request, String adminId, String adminUsername) {
        Incident incident = findOrThrow(id);
        IncidentStatus previous = incident.getStatus();
        incident.setStatus(IncidentStatus.REJECTED);
        incident.setRejectionReason(request.getReason().trim());
        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.REJECTED, previous.name(), IncidentStatus.REJECTED.name(),
            adminId, adminUsername, request.getReason().trim());
        emailNotificationService.sendIncidentStatusChange(saved, previous);
        return toResponse(saved);
    }

    @Transactional
    public IncidentResponse rateResolution(@NonNull Long id, RateRequest request, String keycloakId) {
        Incident incident = findOrThrow(id);
        if (!incident.getReporterKeycloakId().equals(keycloakId)) {
            throw new AccessDeniedException("Only the reporter can rate this incident");
        }
        if (incident.getStatus() != IncidentStatus.RESOLVED) {
            throw new IllegalStateException("Only resolved incidents can be rated");
        }
        incident.setCitizenRating(request.getRating());
        incident.setRatedAt(LocalDateTime.now());
        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.RATED, null, String.valueOf(request.getRating()),
            keycloakId, incident.getReporterUsername(), "Citizen satisfaction rating");
        return toResponse(saved);
    }

    @Transactional
    public void delete(@NonNull Long id) {
        Incident incident = findOrThrow(id);
        incidentRepository.delete(incident);
        log.info("Incident deleted id={}", id);
    }

    public IncidentResponse toResponse(Incident i) {
        boolean overdue = i.getStatus() == IncidentStatus.VALIDATED
            && i.getSlaDeadlineAt() != null
            && LocalDateTime.now().isAfter(i.getSlaDeadlineAt());

        return IncidentResponse.builder()
            .id(i.getId())
            .reporterKeycloakId(i.getReporterKeycloakId())
            .reporterUsername(i.getReporterUsername())
            .title(i.getTitle())
            .description(i.getDescription())
            .status(i.getStatus())
            .category(i.getCategory())
            .latitude(i.getLatitude())
            .longitude(i.getLongitude())
            .address(i.getAddress())
            .aiCategory(i.getAiCategory())
            .aiConfidence(i.getAiConfidence())
            .photoPath(i.getPhotoPath())
            .createdAt(i.getCreatedAt())
            .updatedAt(i.getUpdatedAt())
            .validatedAt(i.getValidatedAt())
            .resolvedAt(i.getResolvedAt())
            .rejectionReason(i.getRejectionReason())
            .assignedDepartment(i.getAssignedDepartment())
            .departmentAssignedAt(i.getDepartmentAssignedAt())
            .departmentFixPhotoPath(i.getDepartmentFixPhotoPath())
            .departmentFixSubmittedAt(i.getDepartmentFixSubmittedAt())
            .departmentReviewReason(i.getDepartmentReviewReason())
            .slaDeadlineAt(i.getSlaDeadlineAt())
            .duplicateOfIncidentId(i.getDuplicateOfIncidentId())
            .citizenRating(i.getCitizenRating())
            .ratedAt(i.getRatedAt())
            .slaOverdue(overdue)
            .build();
    }

    private Incident findOrThrow(@NonNull Long id) {
        return incidentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + id));
    }

    private String storePhoto(MultipartFile file) {
        try {
            Path dir = Paths.get(UPLOAD_DIR);
            Files.createDirectories(dir);
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path target = dir.resolve(fileName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return fileName;
        } catch (IOException e) {
            log.error("Failed to store photo", e);
            return null;
        }
    }
}
