package com.safecity.controller;

import com.safecity.domain.Incident;
import com.safecity.dto.AnalyticsResponse;
import com.safecity.repository.IncidentRepository;
import com.safecity.service.SmartCityTipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final IncidentRepository incidentRepository;
    private final SmartCityTipService smartCityTipService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnalyticsResponse> getAnalytics() {
        List<Incident> allIncidents = incidentRepository.findAll();
        Double avgResTime = incidentRepository.findAverageResolutionTime();

        List<AnalyticsResponse.CategoryStat> categoryStats = incidentRepository.findCategoryStats().stream()
                .map(row -> new AnalyticsResponse.CategoryStat(
                        row[0] != null ? row[0].toString() : "OTHER",
                        ((Number) row[1]).longValue()))
                .collect(Collectors.toList());

        List<AnalyticsResponse.ResolutionTrendStat> trendStats = incidentRepository.findResolutionTimeTrend().stream()
                .map(row -> new AnalyticsResponse.ResolutionTrendStat(
                        row[0].toString(),
                        ((Number) row[1]).doubleValue()))
                .collect(Collectors.toList());

        // Derived Neighborhoods from address (simple split by comma)
        Map<String, Long> neighborhoodCounts = allIncidents.stream()
                .map(i -> i.getAddress() != null ? i.getAddress().split(",")[0].trim() : "Unknown")
                .filter(a -> !a.isEmpty())
                .collect(Collectors.groupingBy(a -> a, Collectors.counting()));

        List<Map<String, Object>> neighborhoodStats = neighborhoodCounts.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .sorted((a, b) -> ((Long) b.get("count")).compareTo((Long) a.get("count")))
                .limit(5)
                .collect(Collectors.toList());

        String regionName = allIncidents.stream()
                .map(Incident::getAddress)
                .filter(addr -> addr != null && !addr.isBlank())
                .map(addr -> {
                    String[] parts = addr.split(",");
                    return parts.length > 0 ? parts[parts.length - 1].trim() : "";
                })
                .filter(name -> !name.isBlank())
                .collect(Collectors.groupingBy(name -> name, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("City");

        String categoriesSummary = categoryStats.stream()
                .map(s -> s.getCategory() + "(" + s.getCount() + ")")
                .collect(Collectors.joining(", "));

        String topNbh = neighborhoodStats.stream()
                .map(n -> n.get("name") + "(" + n.get("count") + ")")
                .collect(Collectors.joining(", "));

        String smartCityTip = smartCityTipService
                .generateSmartCityTip(regionName, categoriesSummary, topNbh)
                .getTip();

        return ResponseEntity.ok(AnalyticsResponse.builder()
                .averageResolutionTime(avgResTime != null ? avgResTime : 0.0)
                .categorySplit(categoryStats)
                .resolutionTrend(trendStats)
                .neighborhoodStats(neighborhoodStats)
                .regionName(regionName)
                .smartCityTip(smartCityTip)
                .build());
    }
}
