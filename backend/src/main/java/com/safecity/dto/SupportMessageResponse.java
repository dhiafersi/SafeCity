package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SupportMessageResponse {
    private Long id;
    private Long threadId;
    private String senderUsername;
    private String senderRole;
    private String body;
    private LocalDateTime createdAt;
}
