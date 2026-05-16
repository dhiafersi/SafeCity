package com.safecity.dto;

import lombok.Data;

/**
 * Request payload for AI description generation.
 */
@Data
public class AiDescriptionRequest {
    private String category;
    private Double confidence;
}
