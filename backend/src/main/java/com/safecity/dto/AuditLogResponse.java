package com.safecity.dto;

import com.safecity.domain.AuditActionType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AuditLogResponse {
    private Long id;
    private Long incidentId;
    private AuditActionType actionType;
    private String oldValue;
    private String newValue;
    private String actorUsername;
    private String note;
    private LocalDateTime createdAt;
}
