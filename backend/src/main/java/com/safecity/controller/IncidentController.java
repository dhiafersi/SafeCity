package com.safecity.controller;

import com.safecity.domain.IncidentCategory;
import com.safecity.dto.*;
import com.safecity.service.*;
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

import java.util.List;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final DuplicateDetectionService duplicateDetectionService;
    private final IncidentAuditService auditService;
    private final IncidentCommentService commentService;
    private final KeycloakUserService keycloakUserService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<IncidentResponse> create(
        @Valid @RequestPart("data") IncidentRequest request,
        @RequestPart(value = "photo", required = false) MultipartFile photo,
        @AuthenticationPrincipal Jwt jwt
    ) {
        IncidentResponse response = incidentService.createIncident(
            request, photo, jwt.getSubject(), jwt.getClaimAsString("preferred_username"), jwt.getClaimAsString("email"));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/check-duplicate")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<DuplicateCheckResponse> checkDuplicate(
        @RequestParam double lat,
        @RequestParam double lng,
        @RequestParam IncidentCategory category
    ) {
        return ResponseEntity.ok(duplicateDetectionService.check(lat, lng, category));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<IncidentResponse>> getAll(
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(incidentService.getAll(pageable));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<Page<IncidentResponse>> getMy(
        @PageableDefault(size = 10, sort = "createdAt") Pageable pageable,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.getMyIncidents(jwt.getSubject(), pageable));
    }

    @GetMapping("/department")
    @PreAuthorize("hasRole('DEPARTMENT')")
    public ResponseEntity<Page<IncidentResponse>> getDepartmentIncidents(
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.getDepartmentIncidents(resolveDepartment(jwt), pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getById(id));
    }

    @GetMapping("/{id}/audit")
    public ResponseEntity<List<AuditLogResponse>> getAudit(@PathVariable Long id) {
        return ResponseEntity.ok(auditService.getTimeline(id));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long id) {
        return ResponseEntity.ok(commentService.list(id));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
        @PathVariable Long id,
        @Valid @RequestBody CommentRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String role = resolveRole(jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(
            commentService.add(id, request, jwt.getSubject(), jwt.getClaimAsString("preferred_username"), role));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody StatusUpdateRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.updateStatus(id, request,
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> assignDepartment(
        @PathVariable Long id,
        @Valid @RequestBody AssignDepartmentRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.assignDepartment(id, request,
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PostMapping(value = "/{id}/department-fix", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DEPARTMENT')")
    public ResponseEntity<IncidentResponse> submitDepartmentFix(
        @PathVariable Long id,
        @RequestPart("photo") MultipartFile photo,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.submitDepartmentFix(id, photo, resolveDepartment(jwt),
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PatchMapping("/{id}/department-fix/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> approveDepartmentFix(
        @PathVariable Long id,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.approveDepartmentFix(id,
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PatchMapping("/{id}/department-fix/refuse")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> refuseDepartmentFix(
        @PathVariable Long id,
        @Valid @RequestBody ReviewFixRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.refuseDepartmentFix(id, request,
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> reject(
        @PathVariable Long id,
        @Valid @RequestBody RejectRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.reject(id, request,
            jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @PostMapping("/{id}/rate")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<IncidentResponse> rate(
        @PathVariable Long id,
        @Valid @RequestBody RateRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(incidentService.rateResolution(id, request, jwt.getSubject()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        incidentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private String resolveRole(Jwt jwt) {
        Object roles = jwt.getClaim("roles");
        if (roles instanceof List<?> list && list.contains("ADMIN")) {
            return "ADMIN";
        }
        if (roles instanceof List<?> list && list.contains("DEPARTMENT")) {
            return "DEPARTMENT";
        }
        return "CITIZEN";
    }

    private String resolveDepartment(Jwt jwt) {
        String department = jwt.getClaimAsString("department");
        if (department != null && !department.isBlank()) {
            return department;
        }

        try {
            department = keycloakUserService.getUser(jwt.getSubject()).getDepartment();
            if (department != null && !department.isBlank()) {
                return department;
            }
        } catch (Exception ignored) {
            // Keep the username fallback for imported demo accounts and offline Keycloak cases.
        }

        department = jwt.getClaimAsString("preferred_username");
        if (department == null) {
            return "";
        }
        String normalized = department.replaceAll("\\d+$", "");
        if (normalized.isBlank()) {
            return department;
        }
        return normalized.substring(0, 1).toUpperCase() + normalized.substring(1).toLowerCase();
    }
}
