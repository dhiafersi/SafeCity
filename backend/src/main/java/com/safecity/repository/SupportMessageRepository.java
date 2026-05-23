package com.safecity.repository;

import com.safecity.domain.SupportMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupportMessageRepository extends JpaRepository<SupportMessage, Long> {
    List<SupportMessage> findByThreadIdOrderByCreatedAtAsc(Long threadId);
    Optional<SupportMessage> findFirstByThreadIdOrderByCreatedAtDesc(Long threadId);
    long countByThreadIdAndSenderRole(Long threadId, String senderRole);
}
