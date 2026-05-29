package com.safecity.service;

import com.safecity.dto.CreateDepartmentUserRequest;
import com.safecity.dto.RegisterRequest;
import com.safecity.dto.UpdateProfileRequest;
import com.safecity.dto.UserAccountResponse;
import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class KeycloakUserService {

    private final WebClient webClient = WebClient.builder().build();

    @Value("${safecity.keycloak.base-url}")
    private String baseUrl;

    @Value("${safecity.keycloak.realm}")
    private String realm;

    @Value("${safecity.keycloak.admin-username}")
    private String adminUsername;

    @Value("${safecity.keycloak.admin-password}")
    private String adminPassword;

    public UserAccountResponse registerCitizen(RegisterRequest request) {
        String userId = createUser(
            request.getUsername(),
            request.getFirstName(),
            request.getLastName(),
            request.getEmail(),
            request.getPassword(),
            true,
            attributes(request.getPhone(), null)
        );
        assignRealmRole(userId, "CITIZEN");
        return getUser(userId);
    }

    public UserAccountResponse createDepartmentUser(CreateDepartmentUserRequest request) {
        String userId = createUser(
            request.getUsername(),
            request.getFirstName(),
            request.getLastName(),
            request.getEmail(),
            request.getPassword(),
            true,
            attributes(null, request.getDepartment().trim())
        );
        assignRealmRole(userId, "DEPARTMENT");
        return getUser(userId);
    }

    public List<UserAccountResponse> listUsers() {
        List<KeycloakUser> users = webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/users?max=200")
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<List<KeycloakUser>>() {})
            .block();

        if (users == null) {
            return List.of();
        }

        return users.stream()
            .map(user -> toResponse(user, getUserRoles(user.getId())))
            .toList();
    }

    public UserAccountResponse getUser(String userId) {
        KeycloakUser user = webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(KeycloakUser.class)
            .block();

        return toResponse(user, getUserRoles(userId));
    }

    public UserAccountResponse updateProfile(String userId, UpdateProfileRequest request) {
        KeycloakUser existing = fetchUser(userId);

        Map<String, Object> body = userUpdateBody(existing);
        body.put("firstName", request.getFirstName().trim());
        body.put("lastName", request.getLastName().trim());
        body.put("email", request.getEmail().trim());
        body.put("attributes", mergeAttributes(existing, request.getPhone()));

        webClient.put()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .toBodilessEntity()
            .block();

        return getUser(userId);
    }

    public UserAccountResponse setEnabled(String userId, boolean enabled) {
        KeycloakUser existing = fetchUser(userId);
        Map<String, Object> body = userUpdateBody(existing);
        body.put("enabled", enabled);

        webClient.put()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .toBodilessEntity()
            .block();

        return getUser(userId);
    }

    private KeycloakUser fetchUser(String userId) {
        return webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(KeycloakUser.class)
            .block();
    }

    private Map<String, Object> userUpdateBody(KeycloakUser user) {
        if (user == null) {
            throw new IllegalStateException("Keycloak user not found");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", user.getUsername());
        body.put("firstName", user.getFirstName());
        body.put("lastName", user.getLastName());
        body.put("email", user.getEmail());
        body.put("enabled", user.getEnabled() == null || user.getEnabled());
        if (user.getAttributes() != null) {
            body.put("attributes", user.getAttributes());
        }
        return body;
    }

    private String createUser(
        String username,
        String firstName,
        String lastName,
        String email,
        String password,
        boolean enabled,
        Map<String, List<String>> attributes
    ) {
        Map<String, Object> credential = new LinkedHashMap<>();
        credential.put("type", "password");
        credential.put("value", password);
        credential.put("temporary", false);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", username.trim());
        body.put("firstName", firstName.trim());
        body.put("lastName", lastName.trim());
        body.put("email", email.trim());
        body.put("enabled", enabled);
        body.put("emailVerified", true);
        body.put("credentials", List.of(credential));
        if (!attributes.isEmpty()) {
            body.put("attributes", attributes);
        }

        URI location = webClient.post()
            .uri(baseUrl + "/admin/realms/" + realm + "/users")
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .toBodilessEntity()
            .map(response -> response.getHeaders().getLocation())
            .block();

        if (location == null) {
            return findUserId(username);
        }
        String path = location.getPath();
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private String findUserId(String username) {
        List<KeycloakUser> users = webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/users?username=" + username)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<List<KeycloakUser>>() {})
            .block();

        if (users == null || users.isEmpty()) {
            throw new IllegalStateException("Keycloak user was created but could not be resolved");
        }
        return users.get(0).getId();
    }

    private void assignRealmRole(String userId, String roleName) {
        KeycloakRole role = webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/roles/" + roleName)
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(KeycloakRole.class)
            .block();

        webClient.post()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId + "/role-mappings/realm")
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(List.of(role))
            .retrieve()
            .toBodilessEntity()
            .block();
    }

    private List<String> getUserRoles(String userId) {
        List<KeycloakRole> roles = webClient.get()
            .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId + "/role-mappings/realm")
            .header(HttpHeaders.AUTHORIZATION, bearer())
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<List<KeycloakRole>>() {})
            .block();

        if (roles == null) {
            return List.of();
        }
        return roles.stream()
            .map(KeycloakRole::getName)
            .filter(role -> role != null && List.of("ADMIN", "CITIZEN", "DEPARTMENT").contains(role))
            .toList();
    }

    private String bearer() {
        return "Bearer " + adminToken();
    }

    private String adminToken() {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("client_id", "admin-cli");
        form.add("username", adminUsername);
        form.add("password", adminPassword);

        Map<String, Object> token = webClient.post()
            .uri(baseUrl + "/realms/master/protocol/openid-connect/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(BodyInserters.fromFormData(form))
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        if (token == null || token.get("access_token") == null) {
            throw new IllegalStateException("Could not authenticate to Keycloak Admin API");
        }
        return token.get("access_token").toString();
    }

    private Map<String, List<String>> attributes(String phone, String department) {
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (phone != null && !phone.isBlank()) {
            attrs.put("phone", List.of(phone.trim()));
        }
        if (department != null && !department.isBlank()) {
            attrs.put("department", List.of(department.trim()));
        }
        return attrs;
    }

    private Map<String, List<String>> mergeAttributes(KeycloakUser existing, String phone) {
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (existing != null && existing.getAttributes() != null) {
            attrs.putAll(existing.getAttributes());
        }
        if (phone == null || phone.isBlank()) {
            attrs.remove("phone");
        } else {
            attrs.put("phone", List.of(phone.trim()));
        }
        return attrs;
    }

    private UserAccountResponse toResponse(KeycloakUser user, List<String> roles) {
        if (user == null) {
            throw new IllegalStateException("Keycloak user not found");
        }
        return UserAccountResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .phone(firstAttribute(user, "phone"))
            .enabled(user.getEnabled())
            .department(firstAttribute(user, "department"))
            .roles(roles == null ? List.of() : roles)
            .build();
    }

    private String firstAttribute(KeycloakUser user, String key) {
        if (user.getAttributes() == null || user.getAttributes().get(key) == null || user.getAttributes().get(key).isEmpty()) {
            return null;
        }
        return user.getAttributes().get(key).get(0);
    }

    @Data
    private static class KeycloakUser {
        private String id;
        private String username;
        private String firstName;
        private String lastName;
        private String email;
        private Boolean enabled;
        private Map<String, List<String>> attributes;
    }

    @Data
    private static class KeycloakRole {
        private String id;
        private String name;
        private String description;
        private Boolean composite;
        private Boolean clientRole;
        private String containerId;
    }
}
