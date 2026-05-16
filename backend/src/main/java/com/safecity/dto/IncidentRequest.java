package com.safecity.dto;

import com.safecity.domain.IncidentCategory;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Incoming request body for creating a new incident report.
 * The photo is handled separately as a MultipartFile parameter.
 */
@Data
public class IncidentRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @DecimalMin(value = "-90.0")
    @DecimalMax(value = "90.0")
    private Double latitude;

    @DecimalMin(value = "-180.0")
    @DecimalMax(value = "180.0")
    private Double longitude;

    private String address;

    private IncidentCategory category;
}
