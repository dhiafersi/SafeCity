package com.safecity.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "incident_audit_logs", indexes = {
    @Index(name = "idx_audit_incident", columnList = "incident_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "incident_id", nullable = false)
    private Long incidentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private AuditActionType actionType;

    @Column(name = "old_value", length = 64)
    private String oldValue;

    @Column(name = "new_value", length = 64)
    private String newValue;

    @Column(name = "actor_keycloak_id")
    private String actorKeycloakId;

    @Column(name = "actor_username", length = 128)
    private String actorUsername;

    @Column(columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
