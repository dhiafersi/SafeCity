package com.safecity.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Core aggregate root representing a citizen-reported urban incident.
 * Coordinates are stored as plain lat/lon doubles (no PostGIS Point here
 * for portability); a PostGIS geography column is added via migration if needed.
 */
@Entity
@Table(name = "incidents", indexes = {
    @Index(name = "idx_incidents_reporter", columnList = "reporter_keycloak_id"),
    @Index(name = "idx_incidents_status",   columnList = "status"),
    @Index(name = "idx_incidents_coords",   columnList = "latitude, longitude")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Reporter (Keycloak subject) ─────────────────────────────────────────
    @Column(name = "reporter_keycloak_id", nullable = false)
    private String reporterKeycloakId;

    @Column(name = "reporter_username")
    private String reporterUsername;

    @Column(name = "reporter_email", length = 256)
    private String reporterEmail;

    // ── Incident details ────────────────────────────────────────────────────
    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private IncidentStatus status = IncidentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    private IncidentCategory category;

    // ── Geolocation ─────────────────────────────────────────────────────────
    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    /** Optional human-readable address resolved from coordinates */
    @Column(name = "address", length = 512)
    private String address;

    // ── AI analysis result ──────────────────────────────────────────────────
    @Column(name = "ai_category", length = 128)
    private String aiCategory;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    // ── Media ────────────────────────────────────────────────────────────────
    /** Relative path or object-storage key for the uploaded photo */
    @Column(name = "photo_path", length = 512)
    private String photoPath;

    // ── Audit ────────────────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "assigned_department", length = 128)
    private String assignedDepartment;

    @Column(name = "department_assigned_at")
    private LocalDateTime departmentAssignedAt;

    @Column(name = "department_fix_photo_path", length = 512)
    private String departmentFixPhotoPath;

    @Column(name = "department_fix_submitted_at")
    private LocalDateTime departmentFixSubmittedAt;

    @Column(name = "department_review_reason", columnDefinition = "TEXT")
    private String departmentReviewReason;

    @Column(name = "sla_deadline_at")
    private LocalDateTime slaDeadlineAt;

    @Column(name = "duplicate_of_incident_id")
    private Long duplicateOfIncidentId;

    @Column(name = "citizen_rating")
    private Integer citizenRating;

    @Column(name = "rated_at")
    private LocalDateTime ratedAt;
}
