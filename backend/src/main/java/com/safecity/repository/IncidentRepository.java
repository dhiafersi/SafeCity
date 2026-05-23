package com.safecity.repository;

import com.safecity.domain.Incident;
import com.safecity.domain.IncidentCategory;
import com.safecity.domain.IncidentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    Page<Incident> findByReporterKeycloakId(String reporterKeycloakId, Pageable pageable);

    Page<Incident> findByStatus(IncidentStatus status, Pageable pageable);

    Page<Incident> findByAssignedDepartmentIgnoreCase(String assignedDepartment, Pageable pageable);

    Page<Incident> findByAssignedDepartmentIsNotNull(Pageable pageable);

    /**
     * Returns lightweight coordinate projections for building the heatmap.
     */
    @Query("SELECT i.latitude, i.longitude, COUNT(i) " +
           "FROM Incident i " +
           "GROUP BY i.latitude, i.longitude")
    List<Object[]> findHeatmapData();

    @Query("SELECT i.category, COUNT(i) FROM Incident i GROUP BY i.category")
    List<Object[]> findCategoryStats();

    @Query(value = "SELECT AVG((EXTRACT(EPOCH FROM resolved_at) - EXTRACT(EPOCH FROM created_at)) / 3600) " +
           "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL", nativeQuery = true)
    Double findAverageResolutionTime();

    @Query(value = "SELECT CAST(resolved_at AS date), AVG((EXTRACT(EPOCH FROM resolved_at) - EXTRACT(EPOCH FROM created_at)) / 3600) " +
           "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL " +
           "GROUP BY CAST(resolved_at AS date) " +
           "ORDER BY CAST(resolved_at AS date) ASC", nativeQuery = true)
    List<Object[]> findResolutionTimeTrend();

    long countByStatus(IncidentStatus status);

    @Query("SELECT i FROM Incident i WHERE i.category = :category AND i.status <> com.safecity.domain.IncidentStatus.REJECTED " +
           "AND i.createdAt >= :since AND ABS(i.latitude - :lat) < :delta AND ABS(i.longitude - :lng) < :delta")
    List<Incident> findPotentialDuplicates(
        @Param("category") IncidentCategory category,
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("since") LocalDateTime since,
        @Param("delta") double delta
    );

    @Query("SELECT COUNT(i) FROM Incident i WHERE i.status = com.safecity.domain.IncidentStatus.VALIDATED " +
           "AND i.slaDeadlineAt IS NOT NULL AND i.slaDeadlineAt < :now")
    long countOverdueSla(@Param("now") LocalDateTime now);

    @Query("SELECT AVG(i.citizenRating) FROM Incident i WHERE i.citizenRating IS NOT NULL")
    Double findAverageRating();

    @Query("SELECT i FROM Incident i WHERE i.createdAt >= :from AND i.createdAt < :to ORDER BY i.createdAt DESC")
    List<Incident> findByCreatedAtBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
