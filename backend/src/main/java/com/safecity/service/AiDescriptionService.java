package com.safecity.service;

import com.safecity.dto.AiDescriptionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiDescriptionService {

    private final WebClient.Builder webClientBuilder;

    @Value("${GEMINI_API_KEY:${gemini.api.key:}}")
    private String geminiApiKey;

    // ✅ ONLY MODERN GEMINI MODELS
    @Value("${gemini.model:gemini-2.5-flash}")
    private String model;

    public AiDescriptionResponse generateDescription(String category, Double confidence) {

        String prompt = buildPrompt(category, confidence);

        String responseText = callGemini(prompt);

        return AiDescriptionResponse.builder()
                .description(responseText)
                .build();
    }

    private String buildPrompt(String category, Double confidence) {

        return """
            You are an assistant for a smart city reporting system.

            Generate a short, professional incident description.

            Rules:
            - 1 to 2 sentences maximum
            - No bullet points
            - No markdown
            - Keep it realistic and factual

            Incident category: %s
            Detection confidence: %s

            Write the description clearly:
            """.formatted(
                category,
                confidence != null ? String.format("%.0f%%", confidence * 100) : "unknown"
        );
    }

    private String callGemini(String prompt) {

        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.warn("Gemini API key is missing.");
            return "AI service not configured.";
        }

        WebClient client = webClientBuilder.build();

        // ✅ CORRECT ENDPOINT (ONLY ONE)
        String url = "https://generativelanguage.googleapis.com/v1/models/"
                + model
                + ":generateContent?key="
                + geminiApiKey;

        // ✅ CORRECT GEMINI PAYLOAD
        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt)
                                )
                        )
                ),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "maxOutputTokens", 1024
                )
        );

        try {
            Map response = client.post()
                    .uri(url)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            return extractText(response);

        } catch (Exception e) {
            log.warn("Gemini request failed: {}", e.getMessage());
            return "Unable to generate AI description at the moment.";
        }
    }

    // ✅ CLEAN RESPONSE PARSER (Gemini format)
    @SuppressWarnings("unchecked")
    private String extractText(Map response) {

        try {
            if (response == null) return null;

            List<Map> candidates = (List<Map>) response.get("candidates");
            if (candidates == null || candidates.isEmpty()) return null;

            Map firstCandidate = candidates.get(0);
            Object contentObj = firstCandidate.get("content");
            if (!(contentObj instanceof Map)) return null;

            Map content = (Map) contentObj;
            Object partsObj = content.get("parts");
            if (!(partsObj instanceof List)) return null;

            List<Map> parts = (List<Map>) partsObj;
            StringBuilder builder = new StringBuilder();

            for (Map part : parts) {
                Object text = part.get("text");
                if (text != null) {
                    if (builder.length() > 0) builder.append(" ");
                    builder.append(text.toString().trim());
                }
            }

            return builder.length() > 0 ? builder.toString().trim() : null;

        } catch (Exception e) {
            log.warn("Failed to parse Gemini response", e);
            return null;
        }
    }
}