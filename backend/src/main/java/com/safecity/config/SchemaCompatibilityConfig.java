package com.safecity.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class SchemaCompatibilityConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    ApplicationRunner incidentWorkflowConstraints() {
        return args -> {
            jdbcTemplate.execute("ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check");
            jdbcTemplate.execute("""
                ALTER TABLE incidents
                ADD CONSTRAINT incidents_status_check
                CHECK (status IN ('PENDING','VALIDATED','ASSIGNED','FIX_SUBMITTED','RESOLVED','REJECTED'))
                """);
            jdbcTemplate.execute("ALTER TABLE incident_audit_logs DROP CONSTRAINT IF EXISTS incident_audit_logs_action_type_check");
            jdbcTemplate.execute("""
                ALTER TABLE incident_audit_logs
                ADD CONSTRAINT incident_audit_logs_action_type_check
                CHECK (action_type IN (
                    'CREATED','STATUS_CHANGED','ASSIGNED','FIX_SUBMITTED','FIX_APPROVED','FIX_REFUSED',
                    'REJECTED','COMMENT_ADDED','SLA_SET','RATED','DUPLICATE_LINKED'
                ))
                """);
        };
    }
}
