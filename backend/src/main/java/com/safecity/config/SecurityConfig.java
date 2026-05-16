package com.safecity.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Spring Security configuration acting as an OAuth2 Resource Server.
 * JWT tokens issued by Keycloak are validated here.
 * Roles are extracted from the "roles" claim injected by the Keycloak protocol mapper.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Public uploaded photos - must come before authenticated endpoints
                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/uploads/**").permitAll()
                // Public map + leaderboard data for landing page
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()

                // AI analysis – citizens only
                .requestMatchers(HttpMethod.POST, "/api/ai/**").hasRole("CITIZEN")

                // Incident creation – citizens
                .requestMatchers(HttpMethod.POST, "/api/incidents").hasRole("CITIZEN")

                // Incident read – both roles (secured endpoints)
                .requestMatchers(HttpMethod.GET,  "/api/incidents/**").authenticated()

                // Status-change / admin actions
                .requestMatchers(HttpMethod.PATCH, "/api/incidents/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/incidents/**").hasRole("ADMIN")

                // Admin-only stats / heatmap
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // Gamification (citizens)
                .requestMatchers("/api/gamification/**").hasRole("CITIZEN")

                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            );

        return http.build();
    }

    /**
     * Extracts realm roles from Keycloak JWT and maps them to Spring Security GrantedAuthorities.
     * Keycloak injects roles as a "roles" claim (via protocol mapper configured in the realm).
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            // Primary: flat "roles" claim added by our custom protocol mapper
            Collection<String> roles;

            Object rolesObj = jwt.getClaim("roles");
            if (rolesObj instanceof List<?> roleList) {
                roles = roleList.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .collect(Collectors.toList());
            } else {
                // Fallback: standard realm_access.roles structure
                Map<String, Object> realmAccess = jwt.getClaim("realm_access");
                if (realmAccess != null && realmAccess.get("roles") instanceof List<?> list) {
                    roles = list.stream()
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .collect(Collectors.toList());
                } else {
                    roles = List.of();
                }
            }

            return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
        });

        return converter;
    }

    /**
     * Custom JwtDecoder that validates tokens using the Keycloak JWK set
     * but skips strict issuer (iss) validation. This avoids failures when
     * issuer-uri environment variables and token iss differ slightly while
     * still enforcing signature and expiry checks.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator()
        );
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("http://localhost:4200", "http://localhost:80"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
