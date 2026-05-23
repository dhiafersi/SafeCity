package com.safecity.dto;

import com.safecity.domain.SupportThreadStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SupportThreadResponse {
    private Long id;
    private String citizenUsername;
    private String subject;
    private SupportThreadStatus status;
    private Long relatedIncidentId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String lastMessagePreview;
    private long unreadForAdmin;
}
