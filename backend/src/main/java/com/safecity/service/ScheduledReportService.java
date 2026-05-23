package com.safecity.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledReportService {

    private final ReportPdfService reportPdfService;
    private final EmailNotificationService emailNotificationService;

    @Value("${safecity.reports.admin-email:}")
    private String adminEmail;

    @Value("${safecity.reports.schedule-enabled:true}")
    private boolean scheduleEnabled;

    /** Weekly PDF summary – Mondays 08:00 server time */
    @Scheduled(cron = "${safecity.reports.schedule-cron:0 0 8 * * MON}")
    public void sendWeeklyReport() {
        if (!scheduleEnabled || adminEmail == null || adminEmail.isBlank()) {
            log.debug("Weekly report skipped (disabled or no admin email)");
            return;
        }
        try {
            LocalDate to = LocalDate.now();
            LocalDate from = to.minusDays(7);
            byte[] pdf = reportPdfService.generatePeriodReport(from, to);
            String subject = "SafeCity Weekly Incident Report (" + from + " – " + to + ")";
            emailNotificationService.sendReportEmail(adminEmail, subject, pdf, "safecity-weekly-report.pdf");
            log.info("Weekly PDF report sent to {}", adminEmail);
        } catch (Exception e) {
            log.warn("Failed to send weekly report: {}", e.getMessage(), e);
        }
    }
}
