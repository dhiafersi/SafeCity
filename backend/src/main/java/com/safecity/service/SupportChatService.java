package com.safecity.service;

import com.safecity.domain.SupportMessage;
import com.safecity.domain.SupportThread;
import com.safecity.domain.SupportThreadStatus;
import com.safecity.dto.*;
import com.safecity.exception.ResourceNotFoundException;
import com.safecity.repository.SupportMessageRepository;
import com.safecity.repository.SupportThreadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportChatService {

    private final SupportThreadRepository threadRepository;
    private final SupportMessageRepository messageRepository;

    @Transactional
    public SupportThreadResponse createThread(SupportThreadRequest request, String keycloakId, String username) {
        SupportThread thread = threadRepository.save(SupportThread.builder()
            .citizenKeycloakId(keycloakId)
            .citizenUsername(username)
            .subject(request.getSubject().trim())
            .relatedIncidentId(request.getRelatedIncidentId())
            .status(SupportThreadStatus.OPEN)
            .build());

        messageRepository.save(SupportMessage.builder()
            .threadId(thread.getId())
            .senderKeycloakId(keycloakId)
            .senderUsername(username)
            .senderRole("CITIZEN")
            .body(request.getMessage().trim())
            .build());

        return toThreadResponse(thread, request.getMessage().trim());
    }

    @Transactional(readOnly = true)
    public List<SupportThreadResponse> listForCitizen(String keycloakId) {
        return threadRepository.findByCitizenKeycloakIdOrderByUpdatedAtDesc(keycloakId).stream()
            .map(t -> toThreadResponse(t, lastPreview(t.getId())))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<SupportThreadResponse> listForAdmin() {
        return threadRepository.findAllByOrderByUpdatedAtDesc().stream()
            .map(t -> {
                long citizenMsgs = messageRepository.countByThreadIdAndSenderRole(t.getId(), "CITIZEN");
                long adminMsgs = messageRepository.countByThreadIdAndSenderRole(t.getId(), "ADMIN");
                long unread = Math.max(0, citizenMsgs - adminMsgs);
                SupportThreadResponse r = toThreadResponse(t, lastPreview(t.getId()));
                r.setUnreadForAdmin(unread);
                return r;
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public List<SupportMessageResponse> getMessages(Long threadId, String keycloakId, boolean isAdmin) {
        SupportThread thread = findThread(threadId);
        if (!isAdmin && !thread.getCitizenKeycloakId().equals(keycloakId)) {
            throw new AccessDeniedException("Access denied to this thread");
        }
        return messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId).stream()
            .map(this::toMessageResponse)
            .toList();
    }

    @Transactional
    public SupportMessageResponse reply(
        Long threadId,
        SupportMessageRequest request,
        String keycloakId,
        String username,
        String role
    ) {
        SupportThread thread = findThread(threadId);
        if ("CITIZEN".equals(role) && !thread.getCitizenKeycloakId().equals(keycloakId)) {
            throw new AccessDeniedException("Access denied to this thread");
        }
        if (thread.getStatus() == SupportThreadStatus.CLOSED) {
            throw new IllegalStateException("Thread is closed");
        }

        SupportMessage msg = messageRepository.save(SupportMessage.builder()
            .threadId(threadId)
            .senderKeycloakId(keycloakId)
            .senderUsername(username)
            .senderRole(role)
            .body(request.getBody().trim())
            .build());

        thread.setUpdatedAt(java.time.LocalDateTime.now());
        threadRepository.save(thread);

        if ("ADMIN".equals(role) && thread.getCitizenKeycloakId() != null) {
            // Notify citizen via email if we had their email – optional future
        }

        return toMessageResponse(msg);
    }

    @Transactional
    public SupportThreadResponse closeThread(Long threadId) {
        SupportThread thread = findThread(threadId);
        thread.setStatus(SupportThreadStatus.CLOSED);
        threadRepository.save(thread);
        return toThreadResponse(thread, lastPreview(threadId));
    }

    private SupportThread findThread(Long id) {
        return threadRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Support thread not found: " + id));
    }

    private String lastPreview(Long threadId) {
        return messageRepository.findFirstByThreadIdOrderByCreatedAtDesc(threadId)
            .map(m -> m.getBody().length() > 80 ? m.getBody().substring(0, 80) + "…" : m.getBody())
            .orElse("");
    }

    private SupportThreadResponse toThreadResponse(SupportThread t, String preview) {
        return SupportThreadResponse.builder()
            .id(t.getId())
            .citizenUsername(t.getCitizenUsername())
            .subject(t.getSubject())
            .status(t.getStatus())
            .relatedIncidentId(t.getRelatedIncidentId())
            .createdAt(t.getCreatedAt())
            .updatedAt(t.getUpdatedAt())
            .lastMessagePreview(preview)
            .build();
    }

    private SupportMessageResponse toMessageResponse(SupportMessage m) {
        return SupportMessageResponse.builder()
            .id(m.getId())
            .threadId(m.getThreadId())
            .senderUsername(m.getSenderUsername())
            .senderRole(m.getSenderRole())
            .body(m.getBody())
            .createdAt(m.getCreatedAt())
            .build();
    }
}
