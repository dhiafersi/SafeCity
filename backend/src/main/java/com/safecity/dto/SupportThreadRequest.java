package com.safecity.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SupportThreadRequest {
    @NotBlank
    private String subject;

    private Long relatedIncidentId;

    @NotBlank
    private String message;
}
