package com.safecity.controller;

import com.safecity.dto.AiAnalysisResponse;
import com.safecity.dto.AiDescriptionRequest;
import com.safecity.dto.AiDescriptionResponse;
import com.safecity.service.AiAnalysisService;
import com.safecity.service.AiDescriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiAnalysisService aiAnalysisService;
    private final AiDescriptionService aiDescriptionService;

    /**
     * POST /api/ai/analyze
     * Accepts an image and returns a predicted category + confidence score.
     * Simulates YOLO model; swap AiAnalysisService implementation for production.
     */
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<AiAnalysisResponse> analyze(
        @RequestPart("image") MultipartFile image
    ) {
        AiAnalysisResponse result = aiAnalysisService.analyze(image);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/describe")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<AiDescriptionResponse> describe(@RequestBody AiDescriptionRequest request) {
        AiDescriptionResponse response = aiDescriptionService.generateDescription(request.getCategory(), request.getConfidence());
        return ResponseEntity.ok(response);
    }
}
