package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CommentResponse {
    private Long id;
    private Long incidentId;
    private String authorUsername;
    private String authorRole;
    private String body;
    private LocalDateTime createdAt;
}
