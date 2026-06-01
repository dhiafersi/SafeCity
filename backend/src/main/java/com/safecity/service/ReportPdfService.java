package com.safecity.service;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
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

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportPdfService {

    private static final Color INK = new Color(24, 31, 42);
    private static final Color MUTED = new Color(96, 110, 128);
    private static final Color NAVY = new Color(16, 24, 39);
    private static final Color BLUE = new Color(29, 136, 229);
    private static final Color CYAN = new Color(0, 188, 212);
    private static final Color GREEN = new Color(67, 160, 71);
    private static final Color ORANGE = new Color(251, 140, 0);
    private static final Color RED = new Color(229, 57, 53);
    private static final Color PAPER = new Color(246, 248, 252);
    private static final Color LINE = new Color(218, 225, 235);

    private static final Font TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, Color.WHITE);
    private static final Font SUBTITLE = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(210, 219, 232));
    private static final Font HEADING = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, INK);
    private static final Font LABEL = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, MUTED);
    private static final Font KPI = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, INK);
    private static final Font BODY = FontFactory.getFont(FontFactory.HELVETICA, 9, INK);
    private static final Font SMALL = FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED);
    private static final Font TABLE_HEAD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);

    private final IncidentRepository incidentRepository;
    private final IncidentAuditService auditService;

    @Transactional(readOnly = true)
    public byte[] generatePeriodReport(LocalDate from, LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay();
        List<Incident> incidents = incidentRepository.findByCreatedAtBetween(fromDt, toDt);

        Document doc = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            long pending = countStatus(incidents, IncidentStatus.PENDING);
            long validated = countStatus(incidents, IncidentStatus.VALIDATED);
            long assigned = countStatus(incidents, IncidentStatus.ASSIGNED);
            long fixSubmitted = countStatus(incidents, IncidentStatus.FIX_SUBMITTED);
            long resolved = countStatus(incidents, IncidentStatus.RESOLVED);
            long rejected = countStatus(incidents, IncidentStatus.REJECTED);
            long overdue = overdueCount(incidents);
            double avgResolutionHours = averageResolutionHours(incidents);

            addReportHeader(doc, from, to, incidents.size());
            addKpiCards(doc, incidents.size(), resolved, pending + validated + assigned + fixSubmitted, overdue, avgResolutionHours);

            PdfPTable summary = new PdfPTable(new float[] { 1.1f, 1f });
            summary.setWidthPercentage(100);
            summary.setSpacingBefore(12);
            summary.addCell(wrappedCell(statusBreakdownTable(pending, validated, assigned, fixSubmitted, resolved, rejected), "Operational Status"));
            summary.addCell(wrappedCell(categoryBreakdownTable(incidents), "Top Categories"));
            doc.add(summary);

            addSectionTitle(doc, "SLA Supervision");
            PdfPTable sla = new PdfPTable(new float[] { 1f, 1f, 1f });
            sla.setWidthPercentage(100);
            addMetricCell(sla, "Validated with overdue SLA", String.valueOf(overdue), overdue > 0 ? RED : GREEN);
            addMetricCell(sla, "Average resolution time", String.format("%.1f h", avgResolutionHours), BLUE);
            addMetricCell(sla, "Resolution rate", incidents.isEmpty() ? "0%" : Math.round((resolved * 100.0) / incidents.size()) + "%", GREEN);
            doc.add(sla);

            addIncidentRegister(doc, incidents);
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

        Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            addDossierHeader(doc, i);
            addSectionTitle(doc, "Incident Details");
            PdfPTable details = new PdfPTable(new float[] { 1f, 2f });
            details.setWidthPercentage(100);
            addDetailRow(details, "Title", safe(i.getTitle()));
            addDetailRow(details, "Description", safe(i.getDescription()));
            addDetailRow(details, "Status", i.getStatus().name());
            addDetailRow(details, "Category", i.getCategory() != null ? i.getCategory().name() : "-");
            addDetailRow(details, "Reporter", safe(i.getReporterUsername()));
            addDetailRow(details, "Location", i.getLatitude() + ", " + i.getLongitude());
            addDetailRow(details, "Address", safe(i.getAddress()));
            addDetailRow(details, "Assigned department", safe(i.getAssignedDepartment()));
            addDetailRow(details, "SLA deadline", i.getSlaDeadlineAt() != null ? formatDateTime(i.getSlaDeadlineAt()) : "-");
            addDetailRow(details, "Citizen rating", i.getCitizenRating() != null ? i.getCitizenRating() + "/5" : "-");
            if (i.getAiCategory() != null) {
                addDetailRow(details, "AI classification", i.getAiCategory() + " (" + (i.getAiConfidence() != null ? i.getAiConfidence() : 0) + ")");
            }
            if (i.getRejectionReason() != null) {
                addDetailRow(details, "Rejection reason", i.getRejectionReason());
            }
            doc.add(details);

            addSectionTitle(doc, "Timeline");
            auditService.getTimeline(incidentId).forEach(entry -> {
                try {
                    doc.add(new Paragraph(
                        formatDateTime(entry.getCreatedAt()) + " - "
                            + entry.getActionType() + ": " + safe(entry.getNote())
                            + (entry.getOldValue() != null ? " (" + entry.getOldValue() + " -> " + entry.getNewValue() + ")" : ""),
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

    private void addReportHeader(Document doc, LocalDate from, LocalDate to, int total) throws DocumentException {
        PdfPTable header = new PdfPTable(new float[] { 2.5f, 1f });
        header.setWidthPercentage(100);

        PdfPCell titleCell = new PdfPCell();
        titleCell.setBackgroundColor(NAVY);
        titleCell.setBorder(Rectangle.NO_BORDER);
        titleCell.setPadding(18);
        titleCell.addElement(new Paragraph("SafeCity Connect", TITLE));
        titleCell.addElement(new Paragraph("Monthly municipal supervision report", SUBTITLE));
        titleCell.addElement(new Paragraph("Period: " + periodLabel(from, to), SUBTITLE));
        header.addCell(titleCell);

        PdfPCell metaCell = new PdfPCell();
        metaCell.setBackgroundColor(BLUE);
        metaCell.setBorder(Rectangle.NO_BORDER);
        metaCell.setPadding(18);
        metaCell.addElement(new Paragraph("REPORT", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE)));
        metaCell.addElement(new Paragraph(String.valueOf(total), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 28, Color.WHITE)));
        metaCell.addElement(new Paragraph("incidents analysed", SUBTITLE));
        metaCell.addElement(new Paragraph("Generated " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), SUBTITLE));
        header.addCell(metaCell);

        doc.add(header);
    }

    private void addDossierHeader(Document doc, Incident incident) throws DocumentException {
        PdfPTable header = new PdfPTable(new float[] { 2.5f, 1f });
        header.setWidthPercentage(100);
        PdfPCell titleCell = new PdfPCell();
        titleCell.setBackgroundColor(NAVY);
        titleCell.setBorder(Rectangle.NO_BORDER);
        titleCell.setPadding(16);
        titleCell.addElement(new Paragraph("Incident Dossier #" + incident.getId(), TITLE));
        titleCell.addElement(new Paragraph("SafeCity Connect case file", SUBTITLE));
        header.addCell(titleCell);
        PdfPCell statusCell = new PdfPCell(new Phrase(incident.getStatus().name(), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE)));
        statusCell.setBackgroundColor(statusColor(incident.getStatus()));
        statusCell.setBorder(Rectangle.NO_BORDER);
        statusCell.setPadding(16);
        statusCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        statusCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        header.addCell(statusCell);
        doc.add(header);
    }

    private void addKpiCards(Document doc, long total, long resolved, long open, long overdue, double avgHours) throws DocumentException {
        PdfPTable cards = new PdfPTable(5);
        cards.setWidthPercentage(100);
        cards.setSpacingBefore(14);
        addMetricCell(cards, "Total reports", String.valueOf(total), BLUE);
        addMetricCell(cards, "Resolved", String.valueOf(resolved), GREEN);
        addMetricCell(cards, "Open workload", String.valueOf(open), ORANGE);
        addMetricCell(cards, "SLA overdue", String.valueOf(overdue), overdue > 0 ? RED : GREEN);
        addMetricCell(cards, "Avg. resolution", String.format("%.1f h", avgHours), CYAN);
        doc.add(cards);
    }

    private void addMetricCell(PdfPTable table, String label, String value, Color accent) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(12);
        cell.setBorderColor(LINE);
        cell.setBackgroundColor(PAPER);
        Paragraph labelP = new Paragraph(label.toUpperCase(), LABEL);
        Paragraph valueP = new Paragraph(value, KPI);
        valueP.getFont().setColor(accent);
        cell.addElement(labelP);
        cell.addElement(valueP);
        table.addCell(cell);
    }

    private PdfPCell wrappedCell(PdfPTable inner, String title) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(10);
        cell.setBorderColor(LINE);
        cell.setBackgroundColor(Color.WHITE);
        cell.addElement(new Paragraph(title, HEADING));
        cell.addElement(inner);
        return cell;
    }

    private PdfPTable statusBreakdownTable(long pending, long validated, long assigned, long fixSubmitted, long resolved, long rejected) {
        PdfPTable table = new PdfPTable(new float[] { 1.4f, .6f });
        table.setWidthPercentage(100);
        addMiniHeader(table, "Status", "Count");
        addMiniRow(table, "Pending", pending, ORANGE);
        addMiniRow(table, "Validated", validated, GREEN);
        addMiniRow(table, "Assigned", assigned, BLUE);
        addMiniRow(table, "Fix submitted", fixSubmitted, CYAN);
        addMiniRow(table, "Resolved", resolved, GREEN);
        addMiniRow(table, "Rejected", rejected, RED);
        return table;
    }

    private PdfPTable categoryBreakdownTable(List<Incident> incidents) {
        Map<String, Long> categories = incidents.stream()
            .collect(Collectors.groupingBy(
                i -> i.getCategory() != null ? i.getCategory().name() : "UNCATEGORIZED",
                LinkedHashMap::new,
                Collectors.counting()
            ));

        PdfPTable table = new PdfPTable(new float[] { 1.4f, .6f });
        table.setWidthPercentage(100);
        addMiniHeader(table, "Category", "Count");
        categories.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
            .limit(8)
            .forEach(e -> addMiniRow(table, e.getKey(), e.getValue(), BLUE));
        if (categories.isEmpty()) {
            addMiniRow(table, "No incident in this period", 0, MUTED);
        }
        return table;
    }

    private void addIncidentRegister(Document doc, List<Incident> incidents) throws DocumentException {
        addSectionTitle(doc, "Incident Register");
        PdfPTable table = new PdfPTable(new float[] { .45f, 2.1f, 1.15f, 1.05f, 1.35f, 1.15f, 1.25f });
        table.setWidthPercentage(100);
        table.setSpacingBefore(8);
        addHeader(table, "ID", "Title", "Category", "Status", "Reporter", "Created", "SLA");

        for (Incident i : incidents) {
            addRow(table,
                String.valueOf(i.getId()),
                safe(i.getTitle()),
                i.getCategory() != null ? i.getCategory().name() : "-",
                i.getStatus().name(),
                safe(i.getReporterUsername()),
                i.getCreatedAt() != null ? formatDateTime(i.getCreatedAt()) : "-",
                i.getSlaDeadlineAt() != null ? formatDateTime(i.getSlaDeadlineAt()) : "-"
            );
        }

        if (incidents.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No incidents were reported during this month.", BODY));
            empty.setColspan(7);
            empty.setPadding(14);
            empty.setHorizontalAlignment(Element.ALIGN_CENTER);
            empty.setBorderColor(LINE);
            table.addCell(empty);
        }
        doc.add(table);
    }

    private void addDetailRow(PdfPTable table, String key, String value) {
        PdfPCell k = new PdfPCell(new Phrase(key, LABEL));
        k.setPadding(8);
        k.setBackgroundColor(PAPER);
        k.setBorderColor(LINE);
        table.addCell(k);

        PdfPCell v = new PdfPCell(new Phrase(value, BODY));
        v.setPadding(8);
        v.setBorderColor(LINE);
        table.addCell(v);
    }

    private void addSectionTitle(Document doc, String text) throws DocumentException {
        Paragraph p = new Paragraph(text, HEADING);
        p.setSpacingBefore(14);
        p.setSpacingAfter(6);
        doc.add(p);
    }

    private void addMiniHeader(PdfPTable table, String left, String right) {
        addMiniCell(table, left, NAVY, Color.WHITE, true);
        addMiniCell(table, right, NAVY, Color.WHITE, true);
    }

    private void addMiniRow(PdfPTable table, String left, long right, Color color) {
        addMiniCell(table, left, Color.WHITE, INK, false);
        addMiniCell(table, String.valueOf(right), Color.WHITE, color, true);
    }

    private void addMiniCell(PdfPTable table, String text, Color bg, Color fg, boolean bold) {
        Font font = FontFactory.getFont(bold ? FontFactory.HELVETICA_BOLD : FontFactory.HELVETICA, 8, fg);
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(6);
        cell.setBorderColor(LINE);
        cell.setBackgroundColor(bg);
        table.addCell(cell);
    }

    private void addHeader(PdfPTable table, String... cols) {
        for (String c : cols) {
            PdfPCell cell = new PdfPCell(new Phrase(c, TABLE_HEAD));
            cell.setBackgroundColor(NAVY);
            cell.setBorderColor(NAVY);
            cell.setPadding(7);
            table.addCell(cell);
        }
    }

    private void addRow(PdfPTable table, String... cols) {
        int index = 0;
        for (String c : cols) {
            PdfPCell cell = new PdfPCell(new Phrase(c, BODY));
            cell.setPadding(6);
            cell.setBorderColor(LINE);
            cell.setBackgroundColor(index % 2 == 0 ? Color.WHITE : new Color(250, 252, 255));
            table.addCell(cell);
            index++;
        }
    }

    private long countStatus(List<Incident> incidents, IncidentStatus status) {
        return incidents.stream().filter(i -> i.getStatus() == status).count();
    }

    private long overdueCount(List<Incident> incidents) {
        return incidents.stream()
            .filter(i -> i.getStatus() == IncidentStatus.VALIDATED)
            .filter(i -> i.getSlaDeadlineAt() != null)
            .filter(i -> LocalDateTime.now().isAfter(i.getSlaDeadlineAt()))
            .count();
    }

    private double averageResolutionHours(List<Incident> incidents) {
        return incidents.stream()
            .filter(i -> i.getCreatedAt() != null && i.getResolvedAt() != null)
            .mapToDouble(i -> Duration.between(i.getCreatedAt(), i.getResolvedAt()).toMinutes() / 60.0)
            .average()
            .orElse(0.0);
    }

    private Color statusColor(IncidentStatus status) {
        return switch (status) {
            case RESOLVED -> GREEN;
            case REJECTED -> RED;
            case PENDING -> ORANGE;
            case VALIDATED -> BLUE;
            case ASSIGNED, FIX_SUBMITTED -> CYAN;
        };
    }

    private String safe(String s) {
        return s != null && !s.isBlank() ? s : "-";
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime.format(DateTimeFormatter.ofPattern("dd/MM/yy HH:mm"));
    }

    private String periodLabel(LocalDate from, LocalDate to) {
        return from.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")) + " to " + to.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
    }
}
