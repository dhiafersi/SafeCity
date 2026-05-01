package com.safecity.dto;

import com.safecity.domain.IncidentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for admin to change the status of an incident.
 */
@Data
public class StatusUpdateRequest {
    @NotNull
    private IncidentStatus status;

    private String adminComment;
}
