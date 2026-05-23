package com.safecity.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "incident_comments", indexes = {
    @Index(name = "idx_comment_incident", columnList = "incident_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "incident_id", nullable = false)
    private Long incidentId;

    @Column(name = "author_keycloak_id", nullable = false)
    private String authorKeycloakId;

    @Column(name = "author_username", length = 128)
    private String authorUsername;

    @Column(name = "author_role", nullable = false, length = 32)
    private String authorRole;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
