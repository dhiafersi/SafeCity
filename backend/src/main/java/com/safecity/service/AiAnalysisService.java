package com.safecity.service;

import com.safecity.dto.AiAnalysisResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * AI Image Analysis Service.
 *
 * Now INTEGRATED with Hugging Face Inference API for zero-shot classification.
 */
@Slf4j
@Service
public class AiAnalysisService {

    @Value("${safecity.ai.simulation-enabled:true}")
    private boolean simulationEnabled;

    @Value("${safecity.ai.hf-token:#{null}}")
    private String hfToken;

    @Value("${safecity.ai.model:openai/clip-vit-base-patch32}")
    private String modelId;

    private static final List<String> CATEGORIES = List.of(
        "POTHOLE", "WATER_LEAK", "BROKEN_STREETLIGHT",
        "GRAFFITI", "ILLEGAL_DUMPING", "FLOODING", "DAMAGED_SIGN"
    );

    private static final List<String> HF_CANDIDATE_LABELS = List.of(
        "pothole", "water leak", "broken street light",
        "graffiti", "illegal dumping", "flooding", "damaged sign"
    );

    private final RestClient restClient = RestClient.create();
    private final Random random = new Random();

    /**
     * Analyzes image via HF Inference API or simulation.
     */
    public AiAnalysisResponse analyze(MultipartFile file) {
        if (simulationEnabled || hfToken == null || hfToken.isBlank()) {
            log.info("AI Service -> Simulation (Token missing: {})", hfToken == null || hfToken.isBlank());
            return simulateAnalysis(file);
        }

        try {
            byte[] bytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(bytes);

            log.info("AI Service -> Calling HF Inference API model: {}", modelId);

            // Build payload for HF Zero-Shot Classification
            Map<String, Object> payload = Map.of(
                "inputs", base64Image,
                "parameters", Map.of("candidate_labels", HF_CANDIDATE_LABELS)
            );

            List<Map<String, Object>> resultList = restClient.post()
                .uri("https://api-inference.huggingface.co/models/" + modelId)
                .header("Authorization", "Bearer " + hfToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            if (resultList == null || resultList.isEmpty()) {
                log.warn("AI Service -> Empty response from HF API");
                return simulateAnalysis(file);
            }

            // Zero-shot usually returns a list of classification objects sorted by score
            // e.g., [{"label":"pothole", "score":0.95}, {"label":"graffiti", "score":0.02}, ...]
            Map<String, Object> topResult = resultList.get(0);
            String label = (String) topResult.get("label");
            Double score = ((Number) topResult.get("score")).doubleValue();

            // Map back to our internal enum-style categories
            String category = mapLabelToCategory(label);
            
            AiAnalysisResponse response = new AiAnalysisResponse();
            response.setCategory(category);
            response.setConfidence(Math.round(score * 100.0) / 100.0);
            response.setSimulated(false);
            response.setMessage("AI Analysis via Hugging Face (" + modelId + ")");
            
            log.info("AI Service -> Result: label='{}' confidence={}", category, score);
            return response;

        } catch (Exception e) {
            log.error("AI Service Error: {}. Falling back to simulation.", e.getMessage());
            return simulateAnalysis(file);
        }
    }

    private String mapLabelToCategory(String label) {
        if (label == null) return "DAMAGED_SIGN";
        switch (label.toLowerCase()) {
            case "pothole": return "POTHOLE";
            case "water leak": return "WATER_LEAK";
            case "broken street light": return "BROKEN_STREETLIGHT";
            case "graffiti": return "GRAFFITI";
            case "illegal dumping": return "ILLEGAL_DUMPING";
            case "flooding": return "FLOODING";
            default: return "DAMAGED_SIGN";
        }
    }

    private AiAnalysisResponse simulateAnalysis(MultipartFile file) {
        String category = CATEGORIES.get(random.nextInt(CATEGORIES.size()));
        double confidence = 0.60 + (random.nextDouble() * 0.35); // 60–95 %

        AiAnalysisResponse response = new AiAnalysisResponse();
        response.setCategory(category);
        response.setConfidence(Math.round(confidence * 100.0) / 100.0);
        response.setSimulated(true);
        response.setMessage("Simulated YOLO prediction for file: " + file.getOriginalFilename());

        return response;
    }
}
