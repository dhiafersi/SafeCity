package com.safecity.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Tracks gamification impact points awarded to citizens when one of their
 * reported incidents transitions to VALIDATED status.
 */
@Entity
@Table(name = "citizen_points", indexes = {
    @Index(name = "idx_points_citizen", columnList = "citizen_keycloak_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CitizenPoints {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "citizen_keycloak_id", nullable = false)
    private String citizenKeycloakId;

    @Column(name = "citizen_username")
    private String citizenUsername;

    /** Total accumulated impact points */
    @Column(nullable = false)
    @Builder.Default
    private Integer totalPoints = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
