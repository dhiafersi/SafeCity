package com.safecity.notification.service;

import com.safecity.notification.dto.IncidentNotificationRequest;
import com.safecity.notification.dto.ReportEmailNotificationRequest;
import com.safecity.notification.dto.SupportNotificationRequest;
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

import java.io.ByteArrayInputStream;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationDeliveryService {

    private final WebClient.Builder webClientBuilder;
    private final JavaMailSender mailSender;

    @Value("${spring.email-api.provider:smtp}")
    private String emailProvider;

    @Value("${spring.email-api.api-key:}")
    private String apiKey;

    @Value("${spring.email-api.api-url:https://api.mailgun.net/v3}")
    private String apiUrl;

    @Value("${spring.email-api.from-email:no-reply@safecity-connect.local}")
    private String fromEmail;

    @Value("${spring.email-api.domain:}")
    private String emailDomain;

    @Value("${safecity.alerts.recipient-email:fersidhia9@gmail.com}")
    private String alertRecipientEmail;

    @Value("${safecity.portal-url:http://localhost:4200}")
    private String portalUrl;

    @Async
    public void sendReportEmail(ReportEmailNotificationRequest request) {
        if (request.toEmail() == null || request.toEmail().isBlank() || request.pdfBase64() == null) {
            return;
        }
        if (!"smtp".equalsIgnoreCase(emailProvider)) {
            log.debug("PDF attachments are only sent through SMTP");
            return;
        }
        try {
            byte[] pdfBytes = Base64.getDecoder().decode(request.pdfBase64());
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(request.toEmail());
            helper.setSubject(valueOrDefault(request.subject(), "SafeCity incident report"));
            helper.setText("<p>Please find the attached SafeCity incident report.</p>", true);
            helper.addAttachment(valueOrDefault(request.filename(), "safecity-report.pdf"),
                () -> new ByteArrayInputStream(pdfBytes),
                "application/pdf");
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send report email: {}", e.getMessage(), e);
        }
    }

    @Async
    public void sendIncidentStatusChange(IncidentNotificationRequest request) {
        if (request.reporterEmail() != null && !request.reporterEmail().isBlank()
            && !safeEquals(request.status(), request.previousStatus())) {
            sendViaProvider(request.reporterEmail(),
                "Your SafeCity report status has been updated",
                buildIncidentStatusEmail(request),
                request.id());
        }

        if (alertRecipientEmail != null && !alertRecipientEmail.isBlank()
            && !safeEquals(alertRecipientEmail, request.reporterEmail())) {
            sendViaProvider(alertRecipientEmail,
                "SafeCity Alert: Incident #" + request.id() + " status changed to " + request.status(),
                buildAdminStatusEmail(request),
                request.id());
        }
    }

    @Async
    public void sendNewIncidentAlert(IncidentNotificationRequest request) {
        if (alertRecipientEmail == null || alertRecipientEmail.isBlank()) {
            return;
        }
        sendViaProvider(alertRecipientEmail,
            "SafeCity Alert: New incident reported [#" + request.id() + "]",
            buildNewIncidentEmail(request),
            request.id());
    }

    @Async
    public void sendSupportMessageAlert(SupportNotificationRequest request) {
        if (alertRecipientEmail == null || alertRecipientEmail.isBlank()) {
            return;
        }
        sendViaProvider(alertRecipientEmail,
            "SafeCity Alert: New support message in thread #" + request.threadId(),
            buildSupportMessageEmail(request),
            request.relatedIncidentId());
    }

    private void sendViaProvider(String toEmail, String subject, String htmlBody, Long referenceId) {
        if ("smtp".equalsIgnoreCase(emailProvider)) {
            sendViaSmtp(toEmail, subject, htmlBody, referenceId);
        } else if ("mailgun".equalsIgnoreCase(emailProvider)) {
            sendViaMailgun(toEmail, subject, htmlBody, referenceId);
        } else if ("sendgrid".equalsIgnoreCase(emailProvider)) {
            sendViaSendGrid(toEmail, subject, htmlBody, referenceId);
        } else {
            log.warn("Unknown email provider: {}", emailProvider);
        }
    }

    private void sendViaSmtp(String toEmail, String subject, String htmlBody, Long referenceId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("Sent notification reference={} to {}", referenceId, toEmail);
        } catch (Exception e) {
            log.warn("Failed to send SMTP notification reference={}: {}", referenceId, e.getMessage(), e);
        }
    }

    private void sendViaMailgun(String toEmail, String subject, String htmlBody, Long referenceId) {
        if (apiKey == null || apiKey.isBlank() || emailDomain == null || emailDomain.isBlank()) {
            log.debug("Skipping Mailgun notification because credentials are not configured");
            return;
        }
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("from", fromEmail);
        params.add("to", toEmail);
        params.add("subject", subject);
        params.add("html", htmlBody);

        String encoded = Base64.getEncoder().encodeToString(("api:" + apiKey).getBytes());
        webClientBuilder.build()
            .post()
            .uri(apiUrl + "/" + emailDomain + "/messages")
            .header("Authorization", "Basic " + encoded)
            .bodyValue(params)
            .retrieve()
            .bodyToMono(String.class)
            .subscribe(
                success -> log.info("Sent Mailgun notification reference={} to {}", referenceId, toEmail),
                error -> log.warn("Failed Mailgun notification reference={}: {}", referenceId, error.getMessage())
            );
    }

    private void sendViaSendGrid(String toEmail, String subject, String htmlBody, Long referenceId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.debug("Skipping SendGrid notification because credentials are not configured");
            return;
        }
        Mono<String> response = webClientBuilder.build()
            .post()
            .uri("https://api.sendgrid.com/v3/mail/send")
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .bodyValue(buildSendGridPayload(toEmail, subject, htmlBody))
            .retrieve()
            .bodyToMono(String.class);

        response.subscribe(
            success -> log.info("Sent SendGrid notification reference={} to {}", referenceId, toEmail),
            error -> log.warn("Failed SendGrid notification reference={}: {}", referenceId, error.getMessage())
        );
    }

    private String wrapHtmlTemplate(String title, String subtitle, String contentHtml, String actionText, String actionUrl) {
        String buttonHtml = "";
        if (actionText != null && actionUrl != null) {
            buttonHtml = "<div style=\"text-align: center; margin: 30px 0 10px;\">"
                + "  <a href=\"" + actionUrl + "\" style=\"display: inline-block; padding: 12px 28px; background-color: #4fc3f7; color: #061018; font-weight: 800; text-decoration: none; border-radius: 8px; font-size: 15px; box-shadow: 0 4px 6px rgba(79, 195, 247, 0.25);\">" + actionText + "</a>"
                + "</div>";
        }

        return "<!DOCTYPE html>"
            + "<html>"
            + "<head>"
            + "  <meta charset=\"utf-8\">"
            + "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
            + "  <title>" + title + "</title>"
            + "  <style>"
            + "    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f8fa; color: #2c3e50; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }"
            + "    .email-container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e1e8ed; }"
            + "    .email-header { background-color: #0f0f1a; padding: 32px; text-align: center; border-bottom: 3px solid #4fc3f7; }"
            + "    .logo-text { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; margin: 0; text-transform: uppercase; }"
            + "    .logo-dot { color: #81c784; }"
            + "    .email-body { padding: 40px 32px; line-height: 1.6; font-size: 16px; }"
            + "    .email-title { font-size: 22px; font-weight: 700; color: #0f0f1a; margin-top: 0; margin-bottom: 8px; }"
            + "    .email-subtitle { font-size: 13px; color: #81c784; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; }"
            + "    .detail-card { background-color: #f8fafd; border: 1px solid #e1e9f5; border-radius: 8px; padding: 20px; margin: 24px 0; }"
            + "    .detail-row { display: table; width: 100%; margin-bottom: 12px; border-bottom: 1px dashed #e1e9f5; padding-bottom: 12px; }"
            + "    .detail-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }"
            + "    .detail-label { display: table-cell; font-weight: 700; color: #5a6e7f; width: 140px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }"
            + "    .detail-value { display: table-cell; color: #0f0f1a; font-size: 15px; vertical-align: middle; }"
            + "    .description-box { background-color: #f5f8fa; border-left: 4px solid #81c784; padding: 14px 18px; margin: 18px 0; border-radius: 0 6px 6px 0; font-style: italic; color: #4b5a68; line-height: 1.5; }"
            + "    .email-footer { background-color: #f8fafd; padding: 24px; text-align: center; font-size: 12px; color: #9fb0bf; border-top: 1px solid #e1e8ed; }"
            + "    a { color: #4fc3f7; text-decoration: none; }"
            + "  </style>"
            + "</head>"
            + "<body>"
            + "  <div class=\"email-container\">"
            + "    <div class=\"email-header\">"
            + "      <div class=\"logo-text\">SafeCity<span class=\"logo-dot\">.</span>Connect</div>"
            + "    </div>"
            + "    <div class=\"email-body\">"
            + "      <h1 class=\"email-title\">" + title + "</h1>"
            + "      <div class=\"email-subtitle\">" + subtitle + "</div>"
            + "      " + contentHtml
            + "      " + buttonHtml
            + "    </div>"
            + "    <div class=\"email-footer\">"
            + "      &copy; 2026 SafeCity Connect. All rights reserved.<br/>"
            + "      This is an automated administrative notification. Please do not reply directly to this email."
            + "    </div>"
            + "  </div>"
            + "</body>"
            + "</html>";
    }

    private String buildIncidentStatusEmail(IncidentNotificationRequest request) {
        String incidentUrl = portalUrl + "/incidents/" + request.id();
        String title = "Incident Status Updated";
        String subtitle = "Citizen Report #" + request.id();

        String contentHtml = "<p>Hello,</p>"
            + "<p>The status of your incident report <strong>\"" + escapeHtml(valueOrDefault(request.title(), "Your report")) + "\"</strong> has been updated.</p>"
            + "<div class=\"detail-card\">"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Previous Status</div>"
            + "    <div class=\"detail-value\" style=\"color: #e02424;\">" + escapeHtml(valueOrDefault(request.previousStatus(), "UNKNOWN")) + "</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">New Status</div>"
            + "    <div class=\"detail-value\" style=\"color: #0e9f6e; font-weight: bold;\">" + escapeHtml(valueOrDefault(request.status(), "UNKNOWN")) + "</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Reported On</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(formatDate(request)) + "</div>"
            + "  </div>"
            + "</div>"
            + "<p>" + statusMessage(request) + "</p>"
            + "<p>You can track the progress of this incident at any time in the SafeCity portal by clicking the button below.</p>";

        return wrapHtmlTemplate(title, subtitle, contentHtml, "Track Report", incidentUrl);
    }

    private String buildAdminStatusEmail(IncidentNotificationRequest request) {
        String adminUrl = portalUrl + "/admin/incidents";
        String title = "Incident Status Changed";
        String subtitle = "Admin Alert";

        String contentHtml = "<p>Incident <strong>#" + request.id() + "</strong> has been updated.</p>"
            + "<div class=\"detail-card\">"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Title</div>"
            + "    <div class=\"detail-value\"><strong>" + escapeHtml(valueOrDefault(request.title(), "No title")) + "</strong></div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Reporter</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(valueOrDefault(request.reporterUsername(), "Anonymous"))
            + " (" + escapeHtml(valueOrDefault(request.reporterEmail(), "N/A")) + ")</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Previous Status</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(valueOrDefault(request.previousStatus(), "UNKNOWN")) + "</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Current Status</div>"
            + "    <div class=\"detail-value\" style=\"color: #4fc3f7; font-weight: bold;\">" + escapeHtml(valueOrDefault(request.status(), "UNKNOWN")) + "</div>"
            + "  </div>"
            + "</div>"
            + "<p>Please review the change in the administrator dashboard.</p>";

        return wrapHtmlTemplate(title, subtitle, contentHtml, "Open Admin Portal", adminUrl);
    }

    private String buildNewIncidentEmail(IncidentNotificationRequest request) {
        String adminUrl = portalUrl + "/admin/incidents";
        String title = "New Incident Reported";
        String subtitle = "Admin Alert";

        String contentHtml = "<p>A new citizen report has been submitted on SafeCity.</p>"
            + "<div class=\"detail-card\">"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Incident ID</div>"
            + "    <div class=\"detail-value\">#" + request.id() + "</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Title</div>"
            + "    <div class=\"detail-value\"><strong>" + escapeHtml(valueOrDefault(request.title(), "No title")) + "</strong></div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Category</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(valueOrDefault(request.category(), "No category")) + "</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Reporter</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(valueOrDefault(request.reporterUsername(), "Anonymous"))
            + " (" + escapeHtml(valueOrDefault(request.reporterEmail(), "N/A")) + ")</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Date</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(formatDate(request)) + "</div>"
            + "  </div>"
            + "</div>"
            + "<p><strong>Citizen Description:</strong></p>"
            + "<div class=\"description-box\">" + escapeHtml(valueOrDefault(request.description(), "No description provided.")) + "</div>"
            + "<p>Please review and assign this report in the admin portal.</p>";

        return wrapHtmlTemplate(title, subtitle, contentHtml, "Review Incident", adminUrl);
    }

    private String buildSupportMessageEmail(SupportNotificationRequest request) {
        String supportUrl = portalUrl + "/admin/support";
        String title = "New Support Message";
        String subtitle = "Support Thread #" + request.threadId();

        String contentHtml = "<p>A new message has been posted in support thread <strong>#" + request.threadId() + "</strong>.</p>"
            + "<div class=\"detail-card\">"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Subject</div>"
            + "    <div class=\"detail-value\"><strong>" + escapeHtml(valueOrDefault(request.subject(), "No subject")) + "</strong></div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Sender</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(valueOrDefault(request.senderUsername(), "Anonymous"))
            + " (" + escapeHtml(valueOrDefault(request.senderRole(), "CITIZEN")) + ")</div>"
            + "  </div>"
            + "  <div class=\"detail-row\">"
            + "    <div class=\"detail-label\">Incident ID</div>"
            + "    <div class=\"detail-value\">" + escapeHtml(request.relatedIncidentId() == null ? "None" : String.valueOf(request.relatedIncidentId())) + "</div>"
            + "  </div>"
            + "</div>"
            + "<p><strong>Message Content:</strong></p>"
            + "<div class=\"description-box\">" + escapeHtml(valueOrDefault(request.body(), "")) + "</div>"
            + "<p>You can reply directly in the admin console by clicking the button below.</p>";

        return wrapHtmlTemplate(title, subtitle, contentHtml, "Reply to Thread", supportUrl);
    }

    private String statusMessage(IncidentNotificationRequest request) {
        return switch (valueOrDefault(request.status(), "UNKNOWN")) {
            case "VALIDATED" -> "Your report has been confirmed by the administration and is now marked as <strong>Validated</strong>.";
            case "RESOLVED" -> "Your report has been resolved and the issue should no longer be active.";
            case "PENDING" -> "Your report is pending review by the SafeCity team.";
            case "REJECTED" -> "Your report was reviewed and <strong>rejected</strong>."
                + (request.rejectionReason() == null ? "" : " Reason: " + escapeHtml(request.rejectionReason()));
            default -> "The status of your report has been updated.";
        };
    }

    private String buildSendGridPayload(String toEmail, String subject, String htmlBody) {
        return "{"
            + "\"personalizations\":[{\"to\":[{\"email\":\"" + escapeJson(toEmail) + "\"}]}],"
            + "\"from\":{\"email\":\"" + escapeJson(fromEmail) + "\"},"
            + "\"subject\":\"" + escapeJson(subject) + "\","
            + "\"content\":[{\"type\":\"text/html\",\"value\":\"" + escapeJson(htmlBody) + "\"}]"
            + "}";
    }

    private String formatDate(IncidentNotificationRequest request) {
        if (request.createdAt() == null) {
            return "Unknown date";
        }
        return request.createdAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private boolean safeEquals(String left, String right) {
        return left == null ? right == null : left.equalsIgnoreCase(right);
    }

    private String escapeHtml(String input) {
        return input == null ? "" : input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String escapeJson(String input) {
        return input == null ? "" : input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
