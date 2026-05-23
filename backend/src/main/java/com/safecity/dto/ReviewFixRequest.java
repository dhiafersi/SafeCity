package com.safecity.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewFixRequest {
    @NotBlank
    private String reason;
}
