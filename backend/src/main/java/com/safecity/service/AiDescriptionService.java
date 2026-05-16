package com.safecity.service;

import com.safecity.dto.AiDescriptionResponse;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Simple AI helper service for generating suggested incident descriptions.
 */
@Service
public class AiDescriptionService {

    private static final Map<String, String> CATEGORY_PROMPTS = Map.of(
        "POTHOLE", "A deep pothole in the road causing unsafe driving conditions and potential vehicle damage.",
        "WATER_LEAK", "Significant water leaking onto the street, potentially causing flooding and slippery surfaces.",
        "BROKEN_STREETLIGHT", "A streetlight that is not working, leaving the area poorly lit at night and unsafe.",
        "GRAFFITI", "Fresh graffiti on public property that reduces cleanliness and damages the community image.",
        "ILLEGAL_DUMPING", "Unauthorized waste or debris dumped in a public area, creating an environmental hazard.",
        "DAMAGED_SIGN", "A damaged or fallen street sign that may confuse drivers and pedestrians.",
        "FLOODING", "Standing water on the road creating a flood hazard and possibly blocking normal traffic flow."
    );

    public AiDescriptionResponse generateDescription(String category, Double confidence) {
        String normalized = category == null ? "" : category.trim().toUpperCase();
        String description = CATEGORY_PROMPTS.getOrDefault(normalized,
            "An issue reported in the area that requires inspection and repair.");

        if (confidence != null) {
            description += " Confidence score: " + String.format("%.0f%%", Math.min(Math.max(confidence * 100, 0), 100));
        }

        return AiDescriptionResponse.builder()
            .description(description)
            .build();
    }
}
