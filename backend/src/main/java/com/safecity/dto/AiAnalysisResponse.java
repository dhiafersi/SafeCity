package com.safecity.dto;

import lombok.Data;

/**
 * Response from the AI image analysis endpoint.
 */
@Data
public class AiAnalysisResponse {
    private String category;
    private Double confidence;
    private boolean simulated;
    private String message;
}
