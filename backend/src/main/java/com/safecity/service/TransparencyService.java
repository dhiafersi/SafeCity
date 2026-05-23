package com.safecity.service;

import com.safecity.domain.IncidentCategory;
import com.safecity.domain.IncidentStatus;
import com.safecity.dto.TransparencyStatsResponse;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TransparencyService {

    private final IncidentRepository incidentRepository;

    @Transactional(readOnly = true)
    public TransparencyStatsResponse getPublicStats() {
        long total = incidentRepository.count();
        long pending = incidentRepository.countByStatus(IncidentStatus.PENDING);
        long validated = incidentRepository.countByStatus(IncidentStatus.VALIDATED);
        long resolved = incidentRepository.countByStatus(IncidentStatus.RESOLVED);
        long rejected = incidentRepository.countByStatus(IncidentStatus.REJECTED);
        long overdue = incidentRepository.countOverdueSla(LocalDateTime.now());

        Double avgHours = incidentRepository.findAverageResolutionTime();
        Double avgRating = incidentRepository.findAverageRating();

        Map<String, Long> byCategory = new LinkedHashMap<>();
        for (Object[] row : incidentRepository.findCategoryStats()) {
            IncidentCategory cat = (IncidentCategory) row[0];
            Long count = (Long) row[1];
            byCategory.put(cat != null ? cat.name() : "UNKNOWN", count);
        }

        Map<String, Long> byStatus = new LinkedHashMap<>();
        byStatus.put("PENDING", pending);
        byStatus.put("VALIDATED", validated);
        byStatus.put("RESOLVED", resolved);
        byStatus.put("REJECTED", rejected);

        return TransparencyStatsResponse.builder()
            .totalReports(total)
            .pendingCount(pending)
            .validatedCount(validated)
            .resolvedCount(resolved)
            .rejectedCount(rejected)
            .overdueCount(overdue)
            .averageResolutionHours(avgHours != null ? avgHours : 0.0)
            .averageCitizenRating(avgRating != null ? avgRating : 0.0)
            .byCategory(byCategory)
            .byStatus(byStatus)
            .build();
    }
}
