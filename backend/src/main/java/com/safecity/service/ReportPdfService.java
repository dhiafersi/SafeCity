package com.safecity.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.safecity.domain.Incident;
import com.safecity.domain.IncidentStatus;
import com.safecity.exception.ResourceNotFoundException;
import com.safecity.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportPdfService {

    private static final Font TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
    private static final Font HEADING = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
    private static final Font BODY = FontFactory.getFont(FontFactory.HELVETICA, 10);

    private final IncidentRepository incidentRepository;
    private final IncidentAuditService auditService;

    @Transactional(readOnly = true)
    public byte[] generatePeriodReport(LocalDate from, LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();
        List<Incident> incidents = incidentRepository.findByCreatedAtBetween(fromDt, toDt);

        Document doc = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph("SafeCity Connect – Incident Report", TITLE));
            doc.add(new Paragraph("Period: " + from + " to " + to, BODY));
            doc.add(new Paragraph("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), BODY));
            doc.add(Chunk.NEWLINE);

            long pending = incidents.stream().filter(i -> i.getStatus() == IncidentStatus.PENDING).count();
            long validated = incidents.stream().filter(i -> i.getStatus() == IncidentStatus.VALIDATED).count();
            long resolved = incidents.stream().filter(i -> i.getStatus() == IncidentStatus.RESOLVED).count();
            long rejected = incidents.stream().filter(i -> i.getStatus() == IncidentStatus.REJECTED).count();

            doc.add(new Paragraph("Summary", HEADING));
            doc.add(new Paragraph("Total: " + incidents.size(), BODY));
            doc.add(new Paragraph("Pending: " + pending + " | Validated: " + validated + " | Resolved: " + resolved + " | Rejected: " + rejected, BODY));
            doc.add(Chunk.NEWLINE);

            PdfPTable table = new PdfPTable(6);
            table.setWidthPercentage(100);
            addHeader(table, "ID", "Title", "Category", "Status", "Reporter", "Created");
            for (Incident i : incidents) {
                addRow(table,
                    String.valueOf(i.getId()),
                    safe(i.getTitle()),
                    i.getCategory() != null ? i.getCategory().name() : "—",
                    i.getStatus().name(),
                    safe(i.getReporterUsername()),
                    i.getCreatedAt() != null ? i.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yy HH:mm")) : "—"
                );
            }
            doc.add(table);
            doc.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("PDF generation failed", e);
        }
        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateIncidentDossier(Long incidentId) {
        Incident i = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + incidentId));

        Document doc = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph("Incident Dossier #" + i.getId(), TITLE));
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("Title: " + safe(i.getTitle()), BODY));
            doc.add(new Paragraph("Description: " + safe(i.getDescription()), BODY));
            doc.add(new Paragraph("Status: " + i.getStatus(), BODY));
            doc.add(new Paragraph("Category: " + (i.getCategory() != null ? i.getCategory() : "—"), BODY));
            doc.add(new Paragraph("Reporter: " + safe(i.getReporterUsername()), BODY));
            doc.add(new Paragraph("Location: " + i.getLatitude() + ", " + i.getLongitude(), BODY));
            doc.add(new Paragraph("Address: " + safe(i.getAddress()), BODY));
            if (i.getAiCategory() != null) {
                doc.add(new Paragraph("AI: " + i.getAiCategory() + " (" + (i.getAiConfidence() != null ? i.getAiConfidence() : 0) + ")", BODY));
            }
            if (i.getRejectionReason() != null) {
                doc.add(new Paragraph("Rejection reason: " + i.getRejectionReason(), BODY));
            }
            if (i.getSlaDeadlineAt() != null) {
                doc.add(new Paragraph("SLA deadline: " + i.getSlaDeadlineAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), BODY));
            }
            if (i.getCitizenRating() != null) {
                doc.add(new Paragraph("Citizen rating: " + i.getCitizenRating() + "/5", BODY));
            }
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("Timeline", HEADING));
            auditService.getTimeline(incidentId).forEach(entry -> {
                try {
                    doc.add(new Paragraph(
                        entry.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yy HH:mm")) + " – "
                            + entry.getActionType() + ": " + safe(entry.getNote())
                            + (entry.getOldValue() != null ? " (" + entry.getOldValue() + " → " + entry.getNewValue() + ")" : ""),
                        BODY
                    ));
                } catch (DocumentException e) {
                    throw new IllegalStateException(e);
                }
            });
            doc.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("PDF generation failed", e);
        }
        return out.toByteArray();
    }

    private void addHeader(PdfPTable table, String... cols) throws DocumentException {
        for (String c : cols) {
            PdfPCell cell = new PdfPCell(new Phrase(c, HEADING));
            cell.setBackgroundColor(new java.awt.Color(230, 230, 230));
            table.addCell(cell);
        }
    }

    private void addRow(PdfPTable table, String... cols) {
        for (String c : cols) {
            table.addCell(new Phrase(c, BODY));
        }
    }

    private String safe(String s) {
        return s != null ? s : "—";
    }
}
