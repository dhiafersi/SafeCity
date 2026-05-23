package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DuplicateCheckResponse {
    private boolean possibleDuplicate;
    private List<IncidentResponse> matches;
}
