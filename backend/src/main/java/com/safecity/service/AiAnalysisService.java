package com.safecity.service;

import com.safecity.dto.AiAnalysisResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Random;

/**
 * AI Image Analysis Service.
 *
 * Now calls an external YOLO-based Python microservice when available.
 */
@Slf4j
@Service
public class AiAnalysisService {

    @Value("${safecity.ai.simulation-enabled:true}")
    private boolean simulationEnabled;

    @Value("${safecity.ai.service-url:http://localhost:8000}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final Random random = new Random();

    private static final List<String> CATEGORIES = List.of(
        "POTHOLE", "WATER_LEAK", "BROKEN_STREETLIGHT",
        "GRAFFITI", "ILLEGAL_DUMPING", "FLOODING", "DAMAGED_SIGN"
    );

    /**
     * Analyzes image via external YOLO microservice or simulation.
     */
    public AiAnalysisResponse analyze(MultipartFile file) {
        if (simulationEnabled) {
            log.info("AI Service -> Simulation enabled. Skipping external AI service.");
            return simulateAnalysis(file);
        }

        try {
            byte[] bytes = file.getBytes();
            log.info("AI Service -> Calling YOLO microservice at {}", aiServiceUrl);

            MultiValueMap<String, Object> formData = new LinkedMultiValueMap<>();
            formData.add("image", new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(formData, headers);

            ResponseEntity<AiAnalysisResponse> response = restTemplate.postForEntity(
                aiServiceUrl + "/analyze",
                request,
                AiAnalysisResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("AI Service -> Received result from YOLO microservice.");
                return response.getBody();
            }

            log.warn("AI Service -> Non-success response from YOLO microservice: {}", response.getStatusCode());
            return simulateAnalysis(file);
        } catch (Exception e) {
            log.error("AI Service Error: {}. Falling back to simulation.", e.getMessage(), e);
            return simulateAnalysis(file);
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
