package com.safecity.service;

import com.safecity.domain.AuditActionType;
import com.safecity.domain.IncidentAuditLog;
import com.safecity.dto.AuditLogResponse;
import com.safecity.repository.IncidentAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentAuditService {

    private final IncidentAuditLogRepository auditLogRepository;

    @Transactional
    public void log(
        Long incidentId,
        AuditActionType actionType,
        String oldValue,
        String newValue,
        String actorKeycloakId,
        String actorUsername,
        String note
    ) {
        auditLogRepository.save(IncidentAuditLog.builder()
            .incidentId(incidentId)
            .actionType(actionType)
            .oldValue(oldValue)
            .newValue(newValue)
            .actorKeycloakId(actorKeycloakId)
            .actorUsername(actorUsername)
            .note(note)
            .build());
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> getTimeline(Long incidentId) {
        return auditLogRepository.findByIncidentIdOrderByCreatedAtAsc(incidentId).stream()
            .map(l -> AuditLogResponse.builder()
                .id(l.getId())
                .incidentId(l.getIncidentId())
                .actionType(l.getActionType())
                .oldValue(l.getOldValue())
                .newValue(l.getNewValue())
                .actorUsername(l.getActorUsername())
                .note(l.getNote())
                .createdAt(l.getCreatedAt())
                .build())
            .toList();
    }
}
