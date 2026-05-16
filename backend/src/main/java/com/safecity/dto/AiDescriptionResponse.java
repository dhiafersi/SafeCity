package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Response payload for AI description generation.
 */
@Data
@Builder
public class AiDescriptionResponse {
    private String description;
}
