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

    /**
     * CRÉATION D'UN INCIDENT
     * 1. Sauvegarde physiquement la photo de l'incident si elle est fournie.
     * 2. Interroge le service de doublons pour lier l'incident si un signalement similaire existe déjà à proximité (500m).
     * 3. Appelle l'IA pour classifier l'image et estimer le niveau de confiance de la catégorie.
     * 4. Enregistre l'incident dans PostgreSQL en statut initial 'PENDING'.
     * 5. Crée des traces d'audit (Historique de l'incident) et envoie une alerte par e-mail.
     */
    @Transactional
    public IncidentResponse createIncident(
        IncidentRequest request,
        MultipartFile photo,
        String keycloakId,
        String username,
        String reporterEmail
    ) {
        // Étape 1 : Traitement et stockage physique de la photo sur le serveur
        String photoPath = null;
        if (photo != null && !photo.isEmpty()) {
            photoPath = storePhoto(photo);
        }

        // Par défaut, coordonnées de Bizerte si non spécifiées
        double lat = request.getLatitude() != null ? request.getLatitude() : 37.2744;
        double lng = request.getLongitude() != null ? request.getLongitude() : 9.8739;

        // Étape 2 : Détection de doublons géographiques (derniers 7 jours, même catégorie)
        Long duplicateId = null;
        if (request.getCategory() != null) {
            duplicateId = duplicateDetectionService.findFirstDuplicateId(lat, lng, request.getCategory());
        }

        // Étape 3 : Construction de l'entité JPA Incident
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

        // Étape 4 : Analyse de l'image par l'IA si une photo est présente
        if (photoPath != null && photo != null) {
            var aiResult = aiAnalysisService.analyze(photo);
            incident.setAiCategory(aiResult.getCategory());
            incident.setAiConfidence(aiResult.getConfidence());
        }

        // Étape 5 : Enregistrement de l'incident dans PostgreSQL
        Incident saved = incidentRepository.save(Objects.requireNonNull(incident));

        // Étape 6 : Journalisation dans la table d'audit (Timeline de l'incident)
        auditService.log(saved.getId(), AuditActionType.CREATED, null, IncidentStatus.PENDING.name(),
            keycloakId, username, "Incident reported");
        if (duplicateId != null) {
            auditService.log(saved.getId(), AuditActionType.DUPLICATE_LINKED, null, String.valueOf(duplicateId),
                keycloakId, username, "Possible duplicate of #" + duplicateId);
        }
        
        log.info("Incident created id={} by user={}", saved.getId(), username);

        // Étape 7 : Envoi asynchrone de la notification e-mail
        try {
            emailNotificationService.sendNewIncidentAlert(saved);
        } catch (Exception e) {
            log.warn("Failed to send new incident alert: {}", e.getMessage());
        }

        // Étape 8 : Conversion de l'entité en DTO IncidentResponse
        return toResponse(saved);
    }

    /**
     * RÉCUPÉRATION D'UN INCIDENT PAR SON ID
     * Cherche l'incident ou lève une exception ResourceNotFoundException si introuvable.
     */
    @Transactional(readOnly = true)
    public IncidentResponse getById(@NonNull Long id) {
        return toResponse(findOrThrow(id));
    }

    /**
     * RÉCUPÉRATION DE TOUS LES INCIDENTS (PAGINÉ)
     * Utilisé principalement par l'administrateur pour afficher la liste globale.
     */
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getAll(@NonNull Pageable pageable) {
        return incidentRepository.findAll(pageable).map(this::toResponse);
    }

    /**
     * RECHERCHE ET FILTRAGE DYNAMIQUE (PAGINÉ)
     * Filtre les incidents par mot-clé (q), statut, catégorie, et boîte de délimitation géographique (Map Bounds).
     */
    @Transactional(readOnly = true)
    public Page<IncidentResponse> search(
        @NonNull Pageable pageable,
        String q,
        IncidentStatus status,
        IncidentCategory category,
        Double minLat,
        Double maxLat,
        Double minLng,
        Double maxLng
    ) {
        String query = q == null || q.isBlank() ? null : q.trim();
        return incidentRepository.search(query, status, category, minLat, maxLat, minLng, maxLng, pageable)
            .map(this::toResponse);
    }

    /**
     * RÉCUPÉRATION DES INCIDENTS DE L'UTILISATEUR CONNECTÉ (CITOYEN)
     * Utilise l'ID Keycloak, l'email ou le nom d'utilisateur pour retrouver ses signalements.
     */
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getMyIncidents(
        String keycloakId,
        String username,
        String email,
        @NonNull Pageable pageable
    ) {
        return incidentRepository.findMyIncidents(keycloakId, email, username, pageable).map(this::toResponse);
    }

    /**
     * RÉCUPÉRATION DES INCIDENTS ASSIGNÉS A UN DÉPARTEMENT TECHNIQUE
     * Si aucun département n'est spécifié, retourne tous les incidents affectés à un service.
     */
    @Transactional(readOnly = true)
    public Page<IncidentResponse> getDepartmentIncidents(String department, @NonNull Pageable pageable) {
        if (department == null || department.isBlank()) {
            return incidentRepository.findByAssignedDepartmentIsNotNull(pageable).map(this::toResponse);
        }
        return incidentRepository.findByAssignedDepartmentIgnoreCase(department.trim(), pageable).map(this::toResponse);
    }

    /**
     * MISE A JOUR DU STATUT D'UN INCIDENT
     * 1. Modifie le statut de l'incident (ex: VALIDATED, RESOLVED).
     * 2. Si VALIDATED : Enregistre l'heure de validation, calcule la date limite SLA (+72h) et attribue des points de gamification au citoyen.
     * 3. Si RESOLVED : Enregistre l'heure de résolution.
     * 4. Enregistre l'incident, ajoute une trace d'audit et envoie un e-mail de notification.
     */
    @Transactional
    public IncidentResponse updateStatus(@NonNull Long id, StatusUpdateRequest request, String adminId, String adminUsername) {
        Incident incident = findOrThrow(id);
        IncidentStatus previousStatus = incident.getStatus();
        IncidentStatus newStatus = request.getStatus();

        incident.setStatus(newStatus);

        // Logique spécifique lors de la validation de l'incident
        if (newStatus == IncidentStatus.VALIDATED && previousStatus != IncidentStatus.VALIDATED) {
            incident.setValidatedAt(LocalDateTime.now());
            incident.setSlaDeadlineAt(LocalDateTime.now().plusHours(slaHours)); // Date limite de résolution
            
            // Attribution des points au citoyen ayant signalé le problème
            gamificationService.awardValidationPoints(
                incident.getReporterKeycloakId(),
                incident.getReporterUsername(),
                incident.getId()
            );
            
            auditService.log(id, AuditActionType.SLA_SET, null, incident.getSlaDeadlineAt().toString(),
                adminId, adminUsername, "SLA deadline set (" + slaHours + "h)");
        }
        
        // Logique spécifique lors de la résolution de l'incident
        if (newStatus == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(LocalDateTime.now());
        }

        Incident saved = incidentRepository.save(incident);
        
        // Journalisation de la modification du statut
        auditService.log(id, AuditActionType.STATUS_CHANGED, previousStatus.name(), newStatus.name(),
            adminId, adminUsername, null);
        
        // Envoi d'email au citoyen pour l'informer du changement de statut
        emailNotificationService.sendIncidentStatusChange(saved, previousStatus);
        
        return toResponse(saved);
    }

    /**
     * AFFECTATION DE L'INCIDENT A UN DÉPARTEMENT TECHNIQUE
     * Modifie le statut à 'ASSIGNED' et affecte le service municipal spécifié (ex: Voirie, Éclairage).
     */
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

        // Renseignement des champs d'affectation
        incident.setAssignedDepartment(department);
        incident.setDepartmentAssignedAt(LocalDateTime.now());
        
        // Réinitialisation des champs de correction en cas de ré-affectation
        incident.setDepartmentReviewReason(null);
        incident.setDepartmentFixPhotoPath(null);
        incident.setDepartmentFixSubmittedAt(null);
        incident.setStatus(IncidentStatus.ASSIGNED);

        Incident saved = incidentRepository.save(incident);
        
        String note = request.getNote() == null || request.getNote().isBlank()
            ? "Assigned to " + department
            : "Assigned to " + department + ": " + request.getNote().trim();
            
        // Enregistrement de l'affectation dans l'audit log
        auditService.log(id, AuditActionType.ASSIGNED, previousStatus.name(), IncidentStatus.ASSIGNED.name(),
            adminId, adminUsername, note);
            
        return toResponse(saved);
    }

    /**
     * SOUMISSION DE LA CORRECTION PAR LE DÉPARTEMENT TECHNIQUE
     * Le département technique envoie la photo prouvant la réalisation des travaux.
     * Le statut passe à 'FIX_SUBMITTED' (en attente d'approbation administrative).
     */
    @Transactional
    public IncidentResponse submitDepartmentFix(
        @NonNull Long id,
        MultipartFile photo,
        String department,
        String userId,
        String username
    ) {
        Incident incident = findOrThrow(id);
        
        // Sécurité métier : Vérifie que l'incident est bien assigné au département demandeur
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
        
        // Enregistrement de la photo de correction et de la date de soumission
        incident.setDepartmentFixPhotoPath(storePhoto(photo));
        incident.setDepartmentFixSubmittedAt(LocalDateTime.now());
        incident.setDepartmentReviewReason(null);
        incident.setStatus(IncidentStatus.FIX_SUBMITTED);

        Incident saved = incidentRepository.save(incident);
        
        auditService.log(id, AuditActionType.FIX_SUBMITTED, previousStatus.name(), IncidentStatus.FIX_SUBMITTED.name(),
            userId, username, "Fix photo submitted by " + incident.getAssignedDepartment());
            
        return toResponse(saved);
    }

    /**
     * MODIFICATION D'UN INCIDENT PAR LE CITOYEN
     * Le citoyen peut modifier son propre incident uniquement s'il est encore en attente ('PENDING').
     */
    @Transactional
    public IncidentResponse updateByCitizen(
        @NonNull Long id,
        @NonNull IncidentRequest request,
        String keycloakId,
        String username
    ) {
        Incident incident = findOrThrow(id);
        
        // Sécurité métier : Vérifie que c'est bien l'auteur du signalement qui tente de modifier
        if (keycloakId == null || !keycloakId.equals(incident.getReporterKeycloakId())) {
            throw new AccessDeniedException("You can only edit your own incidents");
        }
        if (incident.getStatus() != IncidentStatus.PENDING) {
            throw new IllegalStateException("Only pending incidents can be edited");
        }

        incident.setTitle(request.getTitle().trim());
        incident.setDescription(request.getDescription());
        incident.setAddress(request.getAddress());
        incident.setCategory(request.getCategory());
        if (request.getLatitude() != null) {
            incident.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            incident.setLongitude(request.getLongitude());
        }

        Incident saved = incidentRepository.save(incident);
        auditService.log(id, AuditActionType.UPDATED, null, null, keycloakId, username, "Incident updated by citizen");
        return toResponse(saved);
    }

    /**
     * APPROBATION DE LA CORRECTION PAR L'ADMINISTRATEUR
     * L'administrateur valide la photo des travaux. L'incident passe au statut final 'RESOLVED'.
     */
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
            
        // Notification e-mail finale envoyée au citoyen
        emailNotificationService.sendIncidentStatusChange(saved, previousStatus);
        
        return toResponse(saved);
    }

    /**
     * REFUS DE LA CORRECTION PAR L'ADMINISTRATEUR
     * L'administrateur refuse les travaux du département et l'incident repasse en statut 'ASSIGNED'.
     */
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
        
        // Repasse au statut ASSIGNED pour forcer le département à refaire les travaux
        incident.setStatus(IncidentStatus.ASSIGNED);
        incident.setDepartmentReviewReason(reason);

        Incident saved = incidentRepository.save(incident);
        
        auditService.log(id, AuditActionType.FIX_REFUSED, previousStatus.name(), IncidentStatus.ASSIGNED.name(),
            adminId, adminUsername, reason);
            
        return toResponse(saved);
    }

    /**
     * REJET DE L'INCIDENT PAR L'ADMINISTRATEUR
     * L'administrateur rejette le signalement (ex: fausse alerte, hors périmètre) avec un motif obligatoire.
     */
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

    /**
     * NOTATION DE LA RÉSOLUTION PAR LE CITOYEN (RATING)
     * Permet au citoyen de donner une note de satisfaction (1 à 5 étoiles) sur un incident 'RESOLVED'.
     */
    @Transactional
    public IncidentResponse rateResolution(@NonNull Long id, RateRequest request, String keycloakId) {
        Incident incident = findOrThrow(id);
        
        // Sécurité métier : Seul le citoyen auteur du signalement peut le noter
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

    /**
     * SUPPRESSION PHYSIQUE D'UN INCIDENT
     */
    @Transactional
    public void delete(@NonNull Long id) {
        Incident incident = findOrThrow(id);
        incidentRepository.delete(incident);
        log.info("Incident deleted id={}", id);
    }

    /**
     * CONVERSION ENTITÉ -> DTO (IncidentResponse)
     * Transforme l'entité JPA en DTO léger pour l'API REST, et calcule à la volée le flag 'slaOverdue'.
     */
    public IncidentResponse toResponse(Incident i) {
        // Un incident est hors délai (overdue) s'il est validé et que la date actuelle dépasse la date limite du SLA
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
            .slaOverdue(overdue) // Injecte le champ calculé dynamiquement
            .build();
    }

    /**
     * HELPER : RECHERCHE OU EXCEPTION
     */
    private Incident findOrThrow(@NonNull Long id) {
        return incidentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + id));
    }

    /**
     * HELPER : STOCKAGE PHYSIQUE DE L'IMAGE SUR LE SERVEUR
     * Crée le répertoire s'il n'existe pas, génère un UUID unique pour éviter les collisions et y écrit le fichier.
     */
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

