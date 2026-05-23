package com.safecity.controller;

import com.safecity.dto.*;
import com.safecity.service.SupportChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportChatService supportChatService;

    @PostMapping("/threads")
    @PreAuthorize("hasRole('CITIZEN')")
    public ResponseEntity<SupportThreadResponse> createThread(
        @Valid @RequestBody SupportThreadRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            supportChatService.createThread(request, jwt.getSubject(), jwt.getClaimAsString("preferred_username")));
    }

    @GetMapping("/threads")
    public ResponseEntity<List<SupportThreadResponse>> listThreads(@AuthenticationPrincipal Jwt jwt) {
        boolean isAdmin = hasRole(jwt, "ADMIN");
        if (isAdmin) {
            return ResponseEntity.ok(supportChatService.listForAdmin());
        }
        return ResponseEntity.ok(supportChatService.listForCitizen(jwt.getSubject()));
    }

    @GetMapping("/threads/{id}/messages")
    public ResponseEntity<List<SupportMessageResponse>> getMessages(
        @PathVariable Long id,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(supportChatService.getMessages(id, jwt.getSubject(), hasRole(jwt, "ADMIN")));
    }

    @PostMapping("/threads/{id}/messages")
    public ResponseEntity<SupportMessageResponse> reply(
        @PathVariable Long id,
        @Valid @RequestBody SupportMessageRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String role = hasRole(jwt, "ADMIN") ? "ADMIN" : "CITIZEN";
        return ResponseEntity.status(HttpStatus.CREATED).body(
            supportChatService.reply(id, request, jwt.getSubject(), jwt.getClaimAsString("preferred_username"), role));
    }

    @PatchMapping("/threads/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupportThreadResponse> close(@PathVariable Long id) {
        return ResponseEntity.ok(supportChatService.closeThread(id));
    }

    private boolean hasRole(Jwt jwt, String role) {
        Object roles = jwt.getClaim("roles");
        return roles instanceof List<?> list && list.contains(role);
    }
}
