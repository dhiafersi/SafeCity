package com.safecity.controller;

import com.safecity.domain.Incident;
import com.safecity.repository.IncidentRepository;
import com.safecity.service.SmartCityTipService;
import com.safecity.service.SmartCityTipService.SmartCityTip;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
@Slf4j
public class AdminStatsController {

    private final IncidentRepository incidentRepository;
    private final WebClient.Builder webClientBuilder;
    private final SmartCityTipService smartCityTipService;

    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(required = false) String governorate
    ) {

        List<Incident> incidents = incidentRepository.findAll();

        Map<String, Map<String, String>> cache = new HashMap<>();
        List<Incident> filtered = new ArrayList<>();

        for (Incident i : incidents) {

            String key = i.getLatitude() + "," + i.getLongitude();

            Map<String, String> loc = cache.get(key);

            if (loc == null) {
                loc = reverseGeocode(i.getLatitude(), i.getLongitude());
                cache.put(key, loc);
            }

            String gov = loc.get("governorate");

            if (
                    governorate == null ||
                    governorate.isBlank() ||
                    (gov != null && gov.equalsIgnoreCase(governorate))
            ) {
                filtered.add(i);
            }
        }

        Map<String, Long> neighborhoodCounts = filtered.stream()
                .map(i -> {
                    String key = cache.get(
                            i.getLatitude() + "," + i.getLongitude()
                    ).get("delegation");

                    if (key == null || key.isEmpty()) {
                        return i.getAddress() != null
                                ? i.getAddress().split(",")[0].trim()
                                : "Unknown";
                    }

                    return key;
                })
                .filter(a -> a != null && !a.isEmpty())
                .collect(Collectors.groupingBy(a -> a, Collectors.counting()));

        List<Map<String, Object>> topNeighborhoods =
                neighborhoodCounts.entrySet()
                        .stream()
                        .map(e -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("name", e.getKey());
                            m.put("count", e.getValue());
                            return m;
                        })
                        .sorted((a, b) ->
                                Long.compare(
                                        (Long) b.get("count"),
                                        (Long) a.get("count")
                                )
                        )
                        .limit(10)
                        .collect(Collectors.toList());

        String place =
                (governorate == null || governorate.isBlank())
                        ? "the city"
                        : governorate;

        String categoriesSummary = filtered.stream()
                .map(Incident::getCategory)
                .filter(Objects::nonNull)
                .map(Enum::toString)
                .collect(Collectors.groupingBy(c -> c, Collectors.counting()))
                .entrySet()
                .stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .map(e -> e.getKey() + "(" + e.getValue() + ")")
                .collect(Collectors.joining(", "));

        String topNbh = topNeighborhoods.stream()
                .map(m -> m.get("name") + "(" + m.get("count") + ")")
                .collect(Collectors.joining(", "));

        SmartCityTip promptResult = smartCityTipService.generateDashboardTitleAndTip(place, categoriesSummary, topNbh);

        Map<String, Object> result = new HashMap<>();
        result.put("title", promptResult.getTitle());
        result.put("tip", promptResult.getTip());
        result.put("place", place);
        result.put("topNeighborhoods", topNeighborhoods);
        result.put("llmConfigured", smartCityTipService.isConfigured());
        result.put("llmModel", smartCityTipService.getGroqModel());

        return ResponseEntity.ok(result);
    }

    private Map<String, String> reverseGeocode(Double lat, Double lon) {

        Map<String, String> out = new HashMap<>();

        try {

            String url =
                    "https://nominatim.openstreetmap.org/reverse?lat="
                            + URLEncoder.encode(
                                    lat.toString(),
                                    StandardCharsets.UTF_8
                            )
                            + "&lon="
                            + URLEncoder.encode(
                                    lon.toString(),
                                    StandardCharsets.UTF_8
                            )
                            + "&format=json&addressdetails=1&zoom=10";

            WebClient client = webClientBuilder.build();

            Map response = client.get()
                    .uri(url)
                    .header(
                            HttpHeaders.USER_AGENT,
                            "SafeCity/1.0"
                    )
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {

                Map address = (Map) response.get("address");

                if (address != null) {

                    Object gov = address.get("state");

                    if (gov == null) gov = address.get("region");
                    if (gov == null) gov = address.get("country");

                    Object del = address.get("county");

                    if (del == null) del = address.get("city");
                    if (del == null) del = address.get("town");
                    if (del == null) del = address.get("village");

                    if (gov != null) {
                        out.put("governorate", gov.toString());
                    }

                    if (del != null) {
                        out.put("delegation", del.toString());
                    }
                }
            }

        } catch (Exception e) {
            log.warn("Reverse geocode failed: {}", e.getMessage());
        }

        return out;
    }

}
