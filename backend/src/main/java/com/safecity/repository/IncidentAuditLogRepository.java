package com.safecity.repository;

import com.safecity.domain.IncidentAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentAuditLogRepository extends JpaRepository<IncidentAuditLog, Long> {
    List<IncidentAuditLog> findByIncidentIdOrderByCreatedAtAsc(Long incidentId);
}
