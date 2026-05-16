package com.safecity.repository;

import com.safecity.domain.Incident;
import com.safecity.domain.IncidentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    Page<Incident> findByReporterKeycloakId(String reporterKeycloakId, Pageable pageable);

    Page<Incident> findByStatus(IncidentStatus status, Pageable pageable);

    /**
     * Returns lightweight coordinate projections for building the heatmap.
     */
    @Query("SELECT i.latitude, i.longitude, COUNT(i) " +
           "FROM Incident i " +
           "GROUP BY i.latitude, i.longitude")
    List<Object[]> findHeatmapData();

    @Query("SELECT i.category, COUNT(i) FROM Incident i GROUP BY i.category")
    List<Object[]> findCategoryStats();

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) " +
           "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL", nativeQuery = true)
    Double findAverageResolutionTime();

    @Query(value = "SELECT CAST(resolved_at AS date), AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) " +
           "FROM incidents WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL " +
           "GROUP BY CAST(resolved_at AS date) " +
           "ORDER BY CAST(resolved_at AS date) ASC", nativeQuery = true)
    List<Object[]> findResolutionTimeTrend();
}
