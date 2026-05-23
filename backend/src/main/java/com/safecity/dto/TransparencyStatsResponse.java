package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class TransparencyStatsResponse {
    private long totalReports;
    private long pendingCount;
    private long validatedCount;
    private long resolvedCount;
    private long rejectedCount;
    private long overdueCount;
    private double averageResolutionHours;
    private double averageCitizenRating;
    private Map<String, Long> byCategory;
    private Map<String, Long> byStatus;
}
