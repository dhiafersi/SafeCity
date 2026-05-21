package com.safecity.service;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class SmartCityTipService {

    @Value("${GROQ_API_KEY:}")
    private String groqApiKey;

    @Value("${groq.model:llama-3.3-70b-versatile}")
    private String groqModel;

    private final WebClient.Builder webClientBuilder;

    public SmartCityTipService(WebClient.Builder webClientBuilder) {
        this.webClientBuilder = webClientBuilder;
    }

    public SmartCityTip generateSmartCityTip(String place, String categoriesSummary, String topNeighborhoods) {
        String tipPrompt = buildTipPrompt(place, categoriesSummary, topNeighborhoods);
        String tip = callGroq(tipPrompt, 0.4, 180);
        if (tip == null || tip.isBlank()) {
            return new SmartCityTip(null, "No AI recommendation available.");
        }
        return new SmartCityTip(null, tip);
    }

    public SmartCityTip generateDashboardTitleAndTip(String place, String categoriesSummary, String topNeighborhoods) {
        String titlePrompt = buildTitlePrompt(place, topNeighborhoods);
        String tipPrompt = buildTipPrompt(place, categoriesSummary, topNeighborhoods);

        String title = callGroq(titlePrompt, 0.3, 60);
        if (title == null || title.isBlank()) {
            title = "Top Active Neighborhoods";
        }

        String tip = callGroq(tipPrompt, 0.4, 180);
        if (tip == null || tip.isBlank()) {
            tip = "No AI recommendation available.";
        }

        return new SmartCityTip(title, tip);
    }

    private String buildTitlePrompt(String place, String topNeighborhoods) {
        return "Write a short dashboard section title (up to 6 words) for the most reported neighborhoods in "
                + place + ". Top neighborhoods: " + (topNeighborhoods.isEmpty() ? "N/A" : topNeighborhoods) + ".";
    }

    private String buildTipPrompt(String place, String categoriesSummary, String topNeighborhoods) {
        return "You are an urban infrastructure expert. Provide a 2-sentence Smart City Tip for "
                + place
                + " based on the most reported categories: "
                + (categoriesSummary.isEmpty() ? "general issues" : categoriesSummary)
                + ". Mention the top neighborhoods: "
                + (topNeighborhoods.isEmpty() ? "N/A" : topNeighborhoods)
                + ". Provide an actionable recommendation and an estimated percent saving if early maintenance is performed.";
    }

    public String getGroqModel() {
        return groqModel;
    }

    public boolean isConfigured() {
        return groqApiKey != null && !groqApiKey.isBlank();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private String callGroq(String prompt, double temperature, int maxTokens) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            log.warn("Groq API key missing");
            return null;
        }

        try {
            WebClient client = webClientBuilder.build();
            String url = "https://api.groq.com/openai/v1/chat/completions";

            Map<String, Object> body = Map.of(
                    "model", groqModel,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", temperature,
                    "max_tokens", maxTokens
            );

            Map response = client.post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                return null;
            }

            List<Map> choices = (List<Map>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                return null;
            }

            Map first = choices.get(0);
            Object messageObj = first.get("message");
            if (messageObj instanceof Map) {
                Object content = ((Map) messageObj).get("content");
                if (content instanceof String) {
                    return ((String) content).trim();
                }
                if (content instanceof Map) {
                    Object txt = ((Map) content).get("text");
                    if (txt instanceof String) {
                        return ((String) txt).trim();
                    }
                }
            }
            if (first.get("text") != null) {
                return first.get("text").toString().trim();
            }

            return null;
        } catch (Exception e) {
            log.warn("Groq request failed: {}", e.getMessage());
            return null;
        }
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SmartCityTip {
        private String title;
        private String tip;
    }
}
