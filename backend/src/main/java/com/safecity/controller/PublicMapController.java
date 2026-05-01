package com.safecity.controller;

import com.safecity.dto.CitizenPointsResponse;
import com.safecity.dto.IncidentResponse;
import com.safecity.repository.IncidentRepository;
import com.safecity.service.GamificationService;
import com.safecity.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Public, read-only endpoints used by the anonymous landing page map.
 * These do not require authentication and expose only non-sensitive data.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicMapController {

    private final IncidentService incidentService;
    private final IncidentRepository incidentRepository;
    private final GamificationService gamificationService;

    /**
     * GET /api/public/incidents – paged list of incidents for the public map.
     */
    @GetMapping("/incidents")
    public ResponseEntity<Page<IncidentResponse>> getPublicIncidents(
        @PageableDefault(size = 200, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(incidentService.getAll(pageable));
    }

    /**
     * GET /api/public/heatmap – aggregated heatmap data for the public map.
     */
    @GetMapping("/heatmap")
    public ResponseEntity<List<Map<String, Object>>> getPublicHeatmap() {
        List<Object[]> raw = incidentRepository.findHeatmapData();
        List<Map<String, Object>> result = raw.stream()
            .map(row -> {
                Map<String, Object> point = new HashMap<>();
                point.put("lat",   row[0]);
                point.put("lng",   row[1]);
                point.put("count", row[2]);
                return point;
            })
            .toList();
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/public/leaderboard – top contributors (impact points), public.
     */
    @GetMapping("/leaderboard")
    public ResponseEntity<List<CitizenPointsResponse>> getPublicLeaderboard() {
        return ResponseEntity.ok(gamificationService.getTopContributors(5));
    }
}

