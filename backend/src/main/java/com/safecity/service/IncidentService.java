package com.safecity.service;

import com.safecity.domain.Incident;
import com.safecity.domain.IncidentStatus;
import com.safecity.dto.IncidentRequest;
import com.safecity.dto.IncidentResponse;
import com.safecity.dto.StatusUpdateRequest;
import com.safecity.exception.ResourceNotFoundException;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Objects;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final GamificationService gamificationService;
    private final AiAnalysisService aiAnalysisService;
    private final EmailNotificationService emailNotificationService;

    // Upload directory (configurable; in production use object-storage)
    private static final String UPLOAD_DIR = "uploads/incidents/";

    // ── Create ───────────────────────────────────────────────────────────────

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

        Incident incident = Incident.builder()
            .reporterKeycloakId(keycloakId)
            .reporterUsername(username)
            .reporterEmail(reporterEmail)
            .title(request.getTitle())
            .description(request.getDescription())
            .latitude(request.getLatitude() != null ? request.getLatitude() : 37.2744)
            .longitude(request.getLongitude() != null ? request.getLongitude() : 9.8739)
            .address(request.getAddress())
            .category(request.getCategory())
            .photoPath(photoPath)
            .status(IncidentStatus.PENDING)
            .build();

        // Run AI analysis in-line if photo was provided
        if (photoPath != null && photo != null) {
            var aiResult = aiAnalysisService.analyze(photo);
            incident.setAiCategory(aiResult.getCategory());
            incident.setAiConfidence(aiResult.getConfidence());
        }

        Objects.requireNonNull(incident, "Incident must not be null");
        Incident saved = incidentRepository.save(incident);
        log.info("Incident created id={} by user={}", saved.getId(), username);
        return toResponse(saved);
    }

    // ── Read ─────────────────────────────────────────────────────────────────

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

    // ── Update status (Admin) ─────────────────────────────────────────────────

    @Transactional
    public IncidentResponse updateStatus(@NonNull Long id, StatusUpdateRequest request) {
        Incident incident = findOrThrow(id);
        IncidentStatus previousStatus = incident.getStatus();
        IncidentStatus newStatus = request.getStatus();

        incident.setStatus(newStatus);

        if (newStatus == IncidentStatus.VALIDATED && previousStatus != IncidentStatus.VALIDATED) {
            incident.setValidatedAt(LocalDateTime.now());
            // Award gamification points to the citizen reporter
            gamificationService.awardValidationPoints(
                incident.getReporterKeycloakId(),
                incident.getReporterUsername(),
                incident.getId()
            );
        }
        if (newStatus == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(LocalDateTime.now());
        }

        Incident saved = incidentRepository.save(incident);
        // Send email asynchronously - non-blocking
        emailNotificationService.sendIncidentStatusChange(saved, previousStatus);
        return toResponse(saved);
    }

    // ── Delete (Admin) ───────────────────────────────────────────────────────

    @Transactional
    public void delete(@NonNull Long id) {
        Incident incident = findOrThrow(id);
        Objects.requireNonNull(incident, "Incident must not be null");
        incidentRepository.delete(incident);
        log.info("Incident deleted id={}", id);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Incident findOrThrow(@NonNull Long id) {
        Objects.requireNonNull(id, "Incident id must not be null");
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

    private IncidentResponse toResponse(Incident i) {
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
            .build();
    }
}
