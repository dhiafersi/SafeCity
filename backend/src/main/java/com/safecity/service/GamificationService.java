package com.safecity.service;

import com.safecity.domain.CitizenPoints;
import com.safecity.dto.CitizenPointsResponse;
import com.safecity.repository.CitizenPointsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles gamification logic.
 * Currently awards 10 "Impact Points" when a citizen's incident is validated.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GamificationService {

    private static final int VALIDATION_POINTS = 10;

    private final CitizenPointsRepository citizenPointsRepository;

    @Transactional
    public void awardValidationPoints(String citizenKeycloakId, String citizenUsername, Long incidentId) {
        CitizenPoints points = citizenPointsRepository
            .findByCitizenKeycloakId(citizenKeycloakId)
            .orElseGet(() -> CitizenPoints.builder()
                .citizenKeycloakId(citizenKeycloakId)
                .citizenUsername(citizenUsername)
                .totalPoints(0)
                .build());

        points.setCitizenUsername(citizenUsername); // keep fresh
        points.setTotalPoints(points.getTotalPoints() + VALIDATION_POINTS);
        points.setUpdatedAt(LocalDateTime.now());

        citizenPointsRepository.save(points);
        log.info("Awarded {} points to citizen={} for incident={}", VALIDATION_POINTS, citizenUsername, incidentId);
    }

    @Transactional(readOnly = true)
    public CitizenPointsResponse getPoints(String citizenKeycloakId) {
        CitizenPoints points = citizenPointsRepository
            .findByCitizenKeycloakId(citizenKeycloakId)
            .orElse(CitizenPoints.builder()
                .citizenKeycloakId(citizenKeycloakId)
                .totalPoints(0)
                .build());

        return CitizenPointsResponse.builder()
            .citizenKeycloakId(points.getCitizenKeycloakId())
            .citizenUsername(points.getCitizenUsername())
            .totalPoints(points.getTotalPoints())
            .build();
    }

    @Transactional(readOnly = true)
    public List<CitizenPointsResponse> getTopContributors(int limit) {
        return citizenPointsRepository.findTop10ByOrderByTotalPointsDesc()
            .stream()
            .limit(limit)
            .map(points -> CitizenPointsResponse.builder()
                .citizenKeycloakId(points.getCitizenKeycloakId())
                .citizenUsername(points.getCitizenUsername())
                .totalPoints(points.getTotalPoints())
                .build()
            )
            .collect(Collectors.toList());
    }
}
