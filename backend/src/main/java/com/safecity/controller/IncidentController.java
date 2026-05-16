package com.safecity.controller;

import com.safecity.dto.IncidentRequest;
import com.safecity.dto.IncidentResponse;
import com.safecity.dto.StatusUpdateRequest;
import com.safecity.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    /**
     * POST /api/incidents
     * Citizen creates a new incident report (with optional photo).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<IncidentResponse> create(
        @Valid @RequestPart("data") IncidentRequest request,
        @RequestPart(value = "photo", required = false) MultipartFile photo,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String keycloakId = jwt.getSubject();
        String username   = jwt.getClaimAsString("preferred_username");
        String email      = jwt.getClaimAsString("email");
        IncidentResponse response = incidentService.createIncident(request, photo, keycloakId, username, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/incidents – Admin: all incidents (paged)
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<IncidentResponse>> getAll(
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(incidentService.getAll(pageable));
    }

    /**
     * GET /api/incidents/my – Citizen: own incidents
     */
    @GetMapping("/my")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<Page<IncidentResponse>> getMy(
        @PageableDefault(size = 10, sort = "createdAt") Pageable pageable,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.getMyIncidents(jwt.getSubject(), pageable));
    }

    /**
     * GET /api/incidents/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getById(id));
    }

    /**
     * PATCH /api/incidents/{id}/status – Admin changes status
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody StatusUpdateRequest request
    ) {
        return ResponseEntity.ok(incidentService.updateStatus(id, request));
    }

    /**
     * DELETE /api/incidents/{id} – Admin deletes incident
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        incidentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
