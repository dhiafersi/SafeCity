package com.safecity.controller;

import com.safecity.dto.CitizenPointsResponse;
import com.safecity.repository.IncidentRepository;
import com.safecity.service.GamificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GamificationController {

    private final GamificationService gamificationService;
    private final IncidentRepository  incidentRepository;

    /**
     * GET /api/gamification/points – Citizen views own impact points
     */
    @GetMapping("/gamification/points")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<CitizenPointsResponse> getMyPoints(
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(gamificationService.getPoints(jwt.getSubject()));
    }

    /**
     * GET /api/admin/heatmap – Admin retrieves incident density data for heatmap
     */
    @GetMapping("/admin/heatmap")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getHeatmapData() {
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
}
