package com.safecity.repository;

import com.safecity.domain.SupportThread;
import com.safecity.domain.SupportThreadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupportThreadRepository extends JpaRepository<SupportThread, Long> {
    List<SupportThread> findByCitizenKeycloakIdOrderByUpdatedAtDesc(String citizenKeycloakId);
    List<SupportThread> findAllByOrderByUpdatedAtDesc();
    long countByStatus(SupportThreadStatus status);
}
