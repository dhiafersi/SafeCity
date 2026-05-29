package com.safecity.controller;

import com.safecity.dto.UpdateProfileRequest;
import com.safecity.dto.UserAccountResponse;
import com.safecity.service.KeycloakUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final KeycloakUserService keycloakUserService;

    @GetMapping
    public ResponseEntity<UserAccountResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(keycloakUserService.getUser(jwt.getSubject()));
    }

    @PutMapping
    public ResponseEntity<UserAccountResponse> update(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(keycloakUserService.updateProfile(jwt.getSubject(), request));
    }
}
