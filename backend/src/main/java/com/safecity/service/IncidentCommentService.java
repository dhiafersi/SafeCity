package com.safecity.service;

import com.safecity.domain.AuditActionType;
import com.safecity.domain.Incident;
import com.safecity.domain.IncidentComment;
import com.safecity.dto.CommentRequest;
import com.safecity.dto.CommentResponse;
import com.safecity.exception.ResourceNotFoundException;
import com.safecity.repository.IncidentCommentRepository;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentCommentService {

    private final IncidentCommentRepository commentRepository;
    private final IncidentRepository incidentRepository;
    private final IncidentAuditService auditService;

    @Transactional(readOnly = true)
    public List<CommentResponse> list(Long incidentId) {
        ensureIncidentExists(incidentId);
        return commentRepository.findByIncidentIdOrderByCreatedAtAsc(incidentId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public CommentResponse add(
        Long incidentId,
        CommentRequest request,
        String keycloakId,
        String username,
        String role
    ) {
        Incident incident = ensureIncidentExists(incidentId);
        if ("CITIZEN".equals(role) && !incident.getReporterKeycloakId().equals(keycloakId)) {
            throw new AccessDeniedException("You can only comment on your own incidents");
        }

        IncidentComment comment = commentRepository.save(IncidentComment.builder()
            .incidentId(incidentId)
            .authorKeycloakId(keycloakId)
            .authorUsername(username)
            .authorRole(role)
            .body(request.getBody().trim())
            .build());

        auditService.log(incidentId, AuditActionType.COMMENT_ADDED, null, role,
            keycloakId, username, request.getBody().trim());

        return toResponse(comment);
    }

    private Incident ensureIncidentExists(Long incidentId) {
        return incidentRepository.findById(incidentId)
            .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + incidentId));
    }

    private CommentResponse toResponse(IncidentComment c) {
        return CommentResponse.builder()
            .id(c.getId())
            .incidentId(c.getIncidentId())
            .authorUsername(c.getAuthorUsername())
            .authorRole(c.getAuthorRole())
            .body(c.getBody())
            .createdAt(c.getCreatedAt())
            .build();
    }
}
