package com.safecity.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "support_messages", indexes = {
    @Index(name = "idx_support_msg_thread", columnList = "thread_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "thread_id", nullable = false)
    private Long threadId;

    @Column(name = "sender_keycloak_id", nullable = false)
    private String senderKeycloakId;

    @Column(name = "sender_username", length = 128)
    private String senderUsername;

    @Column(name = "sender_role", nullable = false, length = 32)
    private String senderRole;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
