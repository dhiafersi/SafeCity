package com.safecity.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SupportMessageRequest {
    @NotBlank
    private String body;
}
