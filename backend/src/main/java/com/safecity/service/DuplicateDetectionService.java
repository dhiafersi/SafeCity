package com.safecity.service;

import com.safecity.domain.Incident;
import com.safecity.domain.IncidentCategory;
import com.safecity.dto.DuplicateCheckResponse;
import com.safecity.dto.IncidentResponse;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DuplicateDetectionService {

    private static final int DUPLICATE_WINDOW_DAYS = 7;
    private static final double COORD_DELTA = 0.0045;

    private final IncidentRepository incidentRepository;

    @Transactional(readOnly = true)
    public DuplicateCheckResponse check(double lat, double lng, IncidentCategory category) {
        LocalDateTime since = LocalDateTime.now().minusDays(DUPLICATE_WINDOW_DAYS);
        List<Incident> matches = incidentRepository.findPotentialDuplicates(category, lat, lng, since, COORD_DELTA);

        List<IncidentResponse> responses = matches.stream()
            .limit(5)
            .map(this::toBriefResponse)
            .toList();

        return DuplicateCheckResponse.builder()
            .possibleDuplicate(!responses.isEmpty())
            .matches(responses)
            .build();
    }

    @Transactional(readOnly = true)
    public Long findFirstDuplicateId(double lat, double lng, IncidentCategory category) {
        LocalDateTime since = LocalDateTime.now().minusDays(DUPLICATE_WINDOW_DAYS);
        return incidentRepository.findPotentialDuplicates(category, lat, lng, since, COORD_DELTA)
            .stream()
            .findFirst()
            .map(Incident::getId)
            .orElse(null);
    }

    private IncidentResponse toBriefResponse(Incident i) {
        return IncidentResponse.builder()
            .id(i.getId())
            .title(i.getTitle())
            .status(i.getStatus())
            .category(i.getCategory())
            .latitude(i.getLatitude())
            .longitude(i.getLongitude())
            .address(i.getAddress())
            .createdAt(i.getCreatedAt())
            .build();
    }
}
