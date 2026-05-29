package com.safecity.controller;

import com.safecity.dto.CreateDepartmentUserRequest;
import com.safecity.dto.UpdateUserStatusRequest;
import com.safecity.dto.UserAccountResponse;
import com.safecity.service.KeycloakUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final KeycloakUserService keycloakUserService;

    @GetMapping
    public ResponseEntity<List<UserAccountResponse>> list() {
        return ResponseEntity.ok(keycloakUserService.listUsers());
    }

    @PostMapping("/department")
    public ResponseEntity<UserAccountResponse> createDepartmentUser(
        @Valid @RequestBody CreateDepartmentUserRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(keycloakUserService.createDepartmentUser(request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<UserAccountResponse> updateStatus(
        @PathVariable String id,
        @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        return ResponseEntity.ok(keycloakUserService.setEnabled(id, request.getEnabled()));
    }
}
