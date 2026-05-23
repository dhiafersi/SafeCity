package com.safecity.dto;

import com.safecity.domain.IncidentCategory;
import com.safecity.domain.IncidentStatus;
import lombok.Data;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Outgoing response payload for a single incident.
 */
@Data
@Builder
public class IncidentResponse {
    private Long id;
    private String reporterKeycloakId;
    private String reporterUsername;
    private String title;
    private String description;
    private IncidentStatus status;
    private IncidentCategory category;
    private Double latitude;
    private Double longitude;
    private String address;
    private String aiCategory;
    private Double aiConfidence;
    private String photoPath;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime validatedAt;
    private LocalDateTime resolvedAt;
    private String rejectionReason;
    private String assignedDepartment;
    private LocalDateTime departmentAssignedAt;
    private String departmentFixPhotoPath;
    private LocalDateTime departmentFixSubmittedAt;
    private String departmentReviewReason;
    private LocalDateTime slaDeadlineAt;
    private Long duplicateOfIncidentId;
    private Integer citizenRating;
    private LocalDateTime ratedAt;
    private boolean slaOverdue;
}
