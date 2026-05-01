package com.safecity.repository;

import com.safecity.domain.CitizenPoints;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CitizenPointsRepository extends JpaRepository<CitizenPoints, Long> {
    Optional<CitizenPoints> findByCitizenKeycloakId(String citizenKeycloakId);

    List<CitizenPoints> findTop10ByOrderByTotalPointsDesc();
}
