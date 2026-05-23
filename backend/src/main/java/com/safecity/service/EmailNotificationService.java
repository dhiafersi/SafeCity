package com.safecity.service;

import com.safecity.domain.Incident;
import com.safecity.domain.IncidentStatus;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationService {

    private final WebClient.Builder webClientBuilder;
    private final JavaMailSender mailSender;

    @Value("${spring.email-api.provider:mailgun}")
    private String emailProvider;

    @Value("${spring.email-api.api-key:}")
    private String apiKey;

    @Value("${spring.email-api.api-url:https://api.mailgun.net/v3}")
    private String apiUrl;

    @Value("${spring.email-api.from-email:no-reply@safecity-connect.local}")
    private String fromEmail;

    @Value("${spring.email-api.domain:}")
    private String emailDomain;

    @Async
    public void sendReportEmail(String toEmail, String subject, byte[] pdfBytes, String filename) {
        if (toEmail == null || toEmail.isBlank()) {
            return;
        }
        if (!"smtp".equalsIgnoreCase(emailProvider)) {
            log.debug("PDF report email requires SMTP provider");
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText("<p>Please find the attached SafeCity incident report.</p>", true);
            helper.addAttachment(filename, () -> new java.io.ByteArrayInputStream(pdfBytes), "application/pdf");
            mailSender.send(message);
            log.info("Sent PDF report to {}", toEmail);
        } catch (Exception e) {
            log.warn("Failed to send PDF report: {}", e.getMessage(), e);
        }
    }

    @Async
    public void sendIncidentStatusChange(Incident incident, IncidentStatus previousStatus) {
        if (incident == null || incident.getReporterEmail() == null || incident.getReporterEmail().isBlank()) {
            log.debug("Skipping email notification: no reporter email available for incident id={}", incident != null ? incident.getId() : null);
            return;
        }

        if (incident.getStatus() == previousStatus) {
            log.debug("Skipping email notification: incident status did not change for id={}", incident.getId());
            return;
        }

        boolean isSmtp = "smtp".equalsIgnoreCase(emailProvider);
        if (!isSmtp && (apiKey == null || apiKey.isBlank())) {
            log.debug("Skipping email notification: EMAIL_API_KEY not configured");
            return;
        }

        try {
            String subject = "Your SafeCity report status has been updated";
            String htmlBody = buildEmailBody(incident, previousStatus);
            sendViaAPI(incident.getReporterEmail(), subject, htmlBody, incident.getId());
        } catch (Exception e) {
            log.warn("Failed to send incident status update email for incident id={}: {}", incident.getId(), e.getMessage(), e);
        }
    }

    private void sendViaAPI(String toEmail, String subject, String htmlBody, Long incidentId) {
        if ("smtp".equalsIgnoreCase(emailProvider)) {
            sendViaSmtp(toEmail, subject, htmlBody, incidentId);
        } else if ("mailgun".equalsIgnoreCase(emailProvider)) {
            sendViaMailgun(toEmail, subject, htmlBody, incidentId);
        } else if ("sendgrid".equalsIgnoreCase(emailProvider)) {
            sendViaSendGrid(toEmail, subject, htmlBody, incidentId);
        } else {
            log.warn("Unknown email provider: {}", emailProvider);
        }
    }

    private void sendViaSmtp(String toEmail, String subject, String htmlBody, Long incidentId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            mailSender.send(message);
            log.info("Sent incident status email via SMTP for incident id={} to {}", incidentId, toEmail);
        } catch (Exception e) {
            log.warn("Failed to send email via SMTP for incident id={}: {}", incidentId, e.getMessage(), e);
        }
    }

    private void sendViaMailgun(String toEmail, String subject, String htmlBody, Long incidentId) {
        try {
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("from", fromEmail);
            params.add("to", toEmail);
            params.add("subject", subject);
            params.add("html", htmlBody);

            String auth = "api:" + apiKey;
            String encoded = Base64.getEncoder().encodeToString(auth.getBytes());
            String mailgunUrl = apiUrl + "/" + emailDomain + "/messages";

            WebClient client = webClientBuilder.build();
            Mono<String> response = client.post()
                .uri(mailgunUrl)
                .header("Authorization", "Basic " + encoded)
                .bodyValue(params)
                .retrieve()
                .bodyToMono(String.class);

            response.subscribe(
                success -> log.info("Sent incident status email for incident id={} to {}", incidentId, toEmail),
                error -> log.warn("Failed to send email via Mailgun for incident id={}: {}", incidentId, error.getMessage())
            );
        } catch (Exception e) {
            log.warn("Error sending email via Mailgun for incident id={}: {}", incidentId, e.getMessage());
        }
    }

    private void sendViaSendGrid(String toEmail, String subject, String htmlBody, Long incidentId) {
        try {
            String sendgridUrl = "https://api.sendgrid.com/v3/mail/send";
            String jsonBody = buildSendGridPayload(toEmail, subject, htmlBody);

            WebClient client = webClientBuilder.build();
            Mono<String> response = client.post()
                .uri(sendgridUrl)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(jsonBody)
                .retrieve()
                .bodyToMono(String.class);

            response.subscribe(
                success -> log.info("Sent incident status email for incident id={} to {}", incidentId, toEmail),
                error -> log.warn("Failed to send email via SendGrid for incident id={}: {}", incidentId, error.getMessage())
            );
        } catch (Exception e) {
            log.warn("Error sending email via SendGrid for incident id={}: {}", incidentId, e.getMessage());
        }
    }

    private String buildSendGridPayload(String toEmail, String subject, String htmlBody) {
        return "{\n"
            + "  \"personalizations\": [{\n"
            + "    \"to\": [{\n"
            + "      \"email\": \"" + escapeJson(toEmail) + "\"\n"
            + "    }]\n"
            + "  }],\n"
            + "  \"from\": {\n"
            + "    \"email\": \"" + escapeJson(fromEmail) + "\"\n"
            + "  },\n"
            + "  \"subject\": \"" + escapeJson(subject) + "\",\n"
            + "  \"content\": [{\n"
            + "    \"type\": \"text/html\",\n"
            + "    \"value\": \"" + escapeJson(htmlBody) + "\"\n"
            + "  }]\n"
            + "}";
    }

    private String buildEmailBody(Incident incident, IncidentStatus previousStatus) {
        String title = incident.getTitle() != null ? incident.getTitle() : "Your report";
        String status = incident.getStatus().name();
        String previous = previousStatus != null ? previousStatus.name() : "UNKNOWN";
        String incidentUrl = String.format("%s/incidents/%d", "https://safecity.example.com", incident.getId());
        String createdAt = incident.getCreatedAt() != null ? incident.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "Unknown date";

        return "<html><body>"
            + "<h2>SafeCity Incident Status Update</h2>"
            + "<p>Hello,</p>"
            + "<p>Your incident report <strong>" + escapeHtml(title) + "</strong> has changed status.</p>"
            + "<p><strong>Previous status:</strong> " + escapeHtml(previous) + "<br/>"
            + "<strong>Current status:</strong> " + escapeHtml(status) + "</p>"
            + "<p>Report created: " + escapeHtml(createdAt) + "</p>"
            + "<p>" + statusMessage(incident) + "</p>"
            + "<p>View the report in the SafeCity portal: <a href=\"" + incidentUrl + "\">" + incidentUrl + "</a></p>"
            + "<p>Thank you for helping keep the city safe.</p>"
            + "</body></html>";
    }

    private String statusMessage(Incident incident) {
        return switch (incident.getStatus()) {
            case VALIDATED -> "Your report has been confirmed by the administration and is now marked as <strong>Validated</strong>.";
            case RESOLVED -> "Your report has been resolved and the issue should no longer be active.";
            case PENDING -> "Your report is pending review by the SafeCity team.";
            case REJECTED -> "Your report was reviewed and <strong>rejected</strong>."
                + (incident.getRejectionReason() != null ? " Reason: " + escapeHtml(incident.getRejectionReason()) : "");
            default -> "The status of your report has been updated.";
        };
    }

    private String escapeHtml(String input) {
        return input == null ? "" : input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String escapeJson(String input) {
        return input == null ? "" : input.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
