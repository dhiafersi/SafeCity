package com.safecity.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsResponse {

    private Double averageResolutionTime;
    private List<CategoryStat> categorySplit;
    private List<ResolutionTrendStat> resolutionTrend;
    private List<Map<String, Object>> neighborhoodStats;
    private String regionName;
    private String smartCityTip;

    @Getter @Setter @AllArgsConstructor @NoArgsConstructor
    public static class CategoryStat {
        private String category;
        private Long count;
    }

    @Getter @Setter @AllArgsConstructor @NoArgsConstructor
    public static class ResolutionTrendStat {
        private String date;
        private Double averageHours;
    }
}
