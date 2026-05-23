import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IncidentService, IncidentResponse, StatusUpdateRequest, PageResponse } from '../../../core/services/incident.service';
import { ReportService } from '../../../core/services/report.service';

@Component({
// ... (omitting template and styles for brevity in my thought, but tool call needs exact match)
  selector: 'app-incidents-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="incidents-page">
      <div class="page-header">
        <h1>📊 Incident Management</h1>
        <span class="total-badge">{{ totalElements }} total</span>
        <button class="btn-report" (click)="downloadWeeklyReport()" [disabled]="exportingReport">
          {{ exportingReport ? 'Preparing PDF...' : 'Weekly PDF' }}
        </button>
      </div>


      <!-- Filters -->
      <div class="filters-bar">
        <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()" class="filter-select">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VALIDATED">Validated</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="FIX_SUBMITTED">Fix Submitted</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select [(ngModel)]="filterGovernorate" (ngModelChange)="onGovernorateChange()" class="filter-select">
          <option value="">All Gouvernorats</option>
          <option *ngFor="let governorate of governorates" [value]="governorate">{{ governorate }}</option>
        </select>
        <select [(ngModel)]="filterDelegation" (ngModelChange)="applyFilters()" class="filter-select" [disabled]="!filterGovernorate">
          <option value="">All Delegations</option>
          <option *ngFor="let delegation of delegations" [value]="delegation">{{ delegation }}</option>
        </select>
        <button class="btn-refresh" (click)="loadIncidents()">🔄 Refresh</button>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="loading" *ngIf="loading">Loading incidents...</div>

        <table *ngIf="!loading && displayIncidents.length > 0" class="incidents-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Reporter</th>
              <th>Category</th>
              <th>Delegation</th>
              <th>AI Tag</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inc of displayIncidents">
              <td class="id-cell">{{ inc.id }}</td>
              <td class="title-cell">
                <span>{{ inc.title }}</span>
                <small *ngIf="inc.description">{{ inc.description | slice:0:60 }}{{ inc.description!.length > 60 ? '...' : '' }}</small>
              </td>
              <td>{{ inc.reporterUsername }}</td>
              <td>{{ inc.category ?? '—' }}</td>
              <td>{{ inc.delegation ?? inc.governorate ?? '—' }}</td>
              <td>
                <span class="ai-tag" *ngIf="inc.aiCategory">
                  {{ inc.aiCategory }}
                  <small>{{ ((inc.aiConfidence ?? 0) * 100) | number:'1.0-1' }}%</small>
                </span>
                <span class="no-ai" *ngIf="!inc.aiCategory">—</span>
              </td>
              <td>
                <span class="status-chip" [class]="inc.status.toLowerCase()">{{ inc.status }}</span>
              </td>
              <td class="date-cell">{{ inc.createdAt | date:'dd/MM/yy HH:mm' }}</td>
              <td class="actions-cell">
                <div class="action-buttons">
                  <button class="btn-status validate"
                          *ngIf="inc.status === 'PENDING'"
                          (click)="changeStatus(inc, 'VALIDATED')"
                          [disabled]="updating === inc.id"
                          title="Validate">✅</button>
                  <button class="btn-status resolve"
                          *ngIf="inc.status === 'FIX_SUBMITTED'"
                          (click)="approveFix(inc)"
                          [disabled]="updating === inc.id"
                          title="Resolve">🏁</button>
                  <button class="btn-status pending-btn"
                          *ngIf="inc.status !== 'PENDING'"
                          (click)="changeStatus(inc, 'PENDING')"
                          [disabled]="updating === inc.id"
                          title="Reset to Pending">↩️</button>
                  <a class="btn-open"
                     [routerLink]="['/admin/incidents', inc.id]"
                     title="Open details">Open</a>
                  <button class="btn-delete"
                          (click)="deleteIncident(inc)"
                          [disabled]="updating === inc.id"
                          title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty" *ngIf="!loading && displayIncidents.length === 0">
          No incidents found for this filter.
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="goTo(currentPage - 1)" [disabled]="currentPage === 0">‹ Prev</button>
        <span>Page {{ currentPage + 1 }} / {{ totalPages }}</span>
        <button (click)="goTo(currentPage + 1)" [disabled]="currentPage >= totalPages - 1">Next ›</button>
      </div>

      <!-- Toast -->
      <div class="toast" *ngIf="toastMsg" [class]="toastType">
        {{ toastMsg }}
      </div>
    </div>
  `,
  styles: [`
    .incidents-page {
      padding:1.5rem; background:#0f0f1a; min-height:calc(100vh - 60px); color:#fff;
      display:flex; flex-direction:column; gap:1rem;
    }
    .page-header { display:flex; align-items:center; gap:1rem; }
    .page-header h1 { margin:0; font-size:1.3rem; }
    .total-badge {
      background:rgba(79,195,247,.15); color:#4fc3f7;
      border:1px solid rgba(79,195,247,.3); border-radius:20px;
      padding:.2rem .7rem; font-size:.8rem; font-weight:600;
    }

    .filters-bar { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
    .filter-select {
      padding:.45rem .8rem; border-radius:8px; border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06); color:#fff; font-size:.85rem;
    }
    .filter-select option { background:#1a1a2e; }
    .btn-refresh {
      padding:.45rem 1rem; border-radius:8px; border:1px solid rgba(79,195,247,.3);
      background:rgba(79,195,247,.08); color:#4fc3f7; cursor:pointer; font-size:.85rem; transition:.2s;
    }
    .btn-refresh:hover { background:rgba(79,195,247,.18); }
    .btn-report {
      margin-left:auto; padding:.45rem .9rem; border-radius:8px;
      border:1px solid rgba(129,199,132,.35); background:rgba(129,199,132,.1);
      color:#c8e6c9; cursor:pointer; font-size:.82rem; font-weight:600;
    }
    .btn-report:disabled { opacity:.55; cursor:wait; }

    .table-wrapper { overflow-x:auto; border-radius:12px; border:1px solid rgba(255,255,255,.08); }
    .loading, .empty { padding:2rem; text-align:center; color:#888; }

    .incidents-table {
      width:100%; border-collapse:collapse; font-size:.83rem;
    }
    .incidents-table thead {
      background:rgba(255,255,255,.06); position:sticky; top:0;
    }
    .incidents-table th {
      padding:.7rem 1rem; text-align:left; color:#aaa;
      font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.4px;
      border-bottom:1px solid rgba(255,255,255,.07);
    }
    .incidents-table td {
      padding:.65rem 1rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle;
    }
    .incidents-table tr:hover td { background:rgba(79,195,247,.03); }

    .id-cell     { color:#666; font-size:.75rem; }
    .title-cell  { max-width:200px; }
    .title-cell span { display:block; font-weight:500; }
    .title-cell small { display:block; color:#666; font-size:.75rem; margin-top:.15rem; }
    .date-cell   { color:#888; font-size:.78rem; white-space:nowrap; }

    .status-chip {
      font-size:.67rem; font-weight:700; padding:.15rem .55rem;
      border-radius:20px; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap;
    }
    .status-chip.pending   { background:rgba(255,193,7,.15);  color:#ffca28; border:1px solid rgba(255,193,7,.25); }
    .status-chip.validated { background:rgba(129,199,132,.15); color:#81c784; border:1px solid rgba(129,199,132,.25); }
    .status-chip.assigned { background:rgba(255,202,40,.15); color:#ffca28; border:1px solid rgba(255,202,40,.25); }
    .status-chip.fix_submitted { background:rgba(79,195,247,.15); color:#4fc3f7; border:1px solid rgba(79,195,247,.25); }
    .status-chip.resolved  { background:rgba(79,195,247,.15);  color:#4fc3f7; border:1px solid rgba(79,195,247,.25); }
    .status-chip.rejected  { background:rgba(239,83,80,.15);  color:#ef5350; border:1px solid rgba(239,83,80,.25); }

    .ai-tag { color:#ce93d8; display:flex; flex-direction:column; font-size:.78rem; }
    .ai-tag small { color:#888; font-size:.7rem; }
    .no-ai { color:#555; }

    .actions-cell { white-space:nowrap; }
    .action-buttons { display:flex; gap:.3rem; }
    .btn-status, .btn-delete {
      padding:.3rem .5rem; border:none; border-radius:6px;
      cursor:pointer; font-size:.9rem; transition:.15s; background:transparent;
    }
    .btn-open {
      display:inline-flex; align-items:center; padding:.25rem .5rem; border-radius:6px;
      border:1px solid rgba(79,195,247,.25); color:#9bdcf8; text-decoration:none;
      font-size:.75rem; background:rgba(79,195,247,.08);
    }
    .btn-status:hover:not(:disabled) { transform:scale(1.15); }
    .btn-status:disabled, .btn-delete:disabled { opacity:.4; cursor:not-allowed; }
    .btn-delete:hover:not(:disabled) { background:rgba(239,83,80,.15); border-radius:6px; }

    .pagination {
      display:flex; align-items:center; justify-content:center;
      gap:1rem; padding:.75rem; font-size:.85rem;
    }
    .pagination button {
      padding:.4rem .9rem; border-radius:8px; border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.05); color:#fff; cursor:pointer; transition:.2s;
    }
    .pagination button:hover:not(:disabled) { background:rgba(255,255,255,.12); }
    .pagination button:disabled { opacity:.35; cursor:not-allowed; }
    .pagination span { color:#aaa; }

    .toast {
      position:fixed; bottom:1.5rem; right:1.5rem; padding:.75rem 1.25rem;
      border-radius:10px; font-size:.85rem; font-weight:500; z-index:9999;
      animation:slideUp .3s ease;
    }
    .toast.success { background:#1b5e20; color:#a5d6a7; border:1px solid #2e7d32; }
    .toast.error   { background:#7f0000; color:#ef9a9a;  border:1px solid #c62828; }
    @keyframes slideUp {
      from { transform:translateY(20px); opacity:0; }
      to   { transform:translateY(0);    opacity:1; }
    }
  `]
})
export class IncidentsListComponent implements OnInit {
  incidents: IncidentResponse[] = [];
  displayIncidents: IncidentResponse[] = [];
  loading = true;
  updating: number | null = null;
  filterStatus = '';
  filterGovernorate = '';
  filterDelegation = '';

  currentPage  = 0;
  totalPages   = 0;
  totalElements = 0;
  pageSize     = 15;

  governorates: string[] = [];
  delegations: string[] = [];
  private locationCache: Record<string, { governorate?: string; delegation?: string; }> = {};

  toastMsg  = '';
  toastType = 'success';
  exportingReport = false;

  constructor(private incidentService: IncidentService, private reportService: ReportService) {}

  ngOnInit(): void {
    this.loadIncidents();
  }

  loadIncidents(): void {
    this.loading = true;
    this.incidentService.getAll(this.currentPage, this.pageSize).subscribe({
      next: async (page: PageResponse<IncidentResponse>) => {
        this.incidents     = page.content;
        this.totalPages    = page.totalPages;
        this.totalElements = page.totalElements;

        await this.assignLocations(this.incidents);
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.showToast('Failed to load incidents', 'error');
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.displayIncidents = this.incidents.filter(incident => {
      const statusMatch = !this.filterStatus || incident.status === this.filterStatus;
      const governorateMatch = !this.filterGovernorate || incident.governorate === this.filterGovernorate;
      const delegationMatch = !this.filterDelegation || incident.delegation === this.filterDelegation;
      return statusMatch && governorateMatch && delegationMatch;
    });
  }

  private async assignLocations(incidents: IncidentResponse[]): Promise<void> {
    const promises = incidents.map(async incident => {
      if (incident.governorate || incident.delegation) return;
      const cacheKey = `${incident.latitude},${incident.longitude}`;
      if (this.locationCache[cacheKey]) {
        incident.governorate = this.locationCache[cacheKey].governorate;
        incident.delegation = this.locationCache[cacheKey].delegation;
        return;
      }

      const location = await this.getLocation(incident.latitude, incident.longitude);
      incident.governorate = location.governorate;
      incident.delegation = location.delegation;
      this.locationCache[cacheKey] = location;
    });

    await Promise.all(promises);
    this.governorates = Array.from(new Set(incidents
      .map(i => i.governorate)
      .filter((g): g is string => !!g)
      .sort()));

    this.updateDelegations();
  }

  private updateDelegations(): void {
    if (!this.filterGovernorate) {
      this.delegations = [];
      this.filterDelegation = '';
      return;
    }

    this.delegations = Array.from(new Set(this.incidents
      .filter(i => i.governorate === this.filterGovernorate)
      .map(i => i.delegation)
      .filter((d): d is string => !!d)
      .sort()));

    if (this.filterDelegation && !this.delegations.includes(this.filterDelegation)) {
      this.filterDelegation = '';
    }
  }

  onGovernorateChange(): void {
    this.updateDelegations();
    this.applyFilters();
  }


  private async getLocation(lat: number, lon: number): Promise<{ governorate?: string; delegation?: string }> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&zoom=12`;
      const response = await fetch(url);
      if (!response.ok) return {};

      const data = await response.json();
      const address = data?.address || {};
      const governorate = address.state || address.region || address.country;
      const delegation = address.state_district || address.county || address.city || address.town || address.village || address.suburb;
      return { governorate, delegation };
    } catch {
      return {};
    }
  }

  goTo(page: number): void {
    this.currentPage = page;
    this.loadIncidents();
  }

  changeStatus(inc: IncidentResponse, status: 'PENDING' | 'VALIDATED' | 'RESOLVED'): void {
    this.updating = inc.id;
    const body: StatusUpdateRequest = { status };

    this.incidentService.updateStatus(inc.id, body).subscribe({
      next: (updated: IncidentResponse) => {
        const idx = this.incidents.findIndex(i => i.id === updated.id);
        if (idx > -1) this.incidents[idx] = updated;
        this.updating = null;
        this.showToast(`Incident #${inc.id} marked as ${status}`, 'success');
      },
      error: () => {
        this.updating = null;
        this.showToast('Failed to update status', 'error');
      }
    });
  }

  approveFix(inc: IncidentResponse): void {
    this.updating = inc.id;

    this.incidentService.approveDepartmentFix(inc.id).subscribe({
      next: (updated: IncidentResponse) => {
        const idx = this.incidents.findIndex(i => i.id === updated.id);
        if (idx > -1) this.incidents[idx] = updated;
        this.applyFilters();
        this.updating = null;
        this.showToast(`Incident #${inc.id} marked as resolved`, 'success');
      },
      error: () => {
        this.updating = null;
        this.showToast('Failed to approve fix', 'error');
      }
    });
  }

  deleteIncident(inc: IncidentResponse): void {
    if (!confirm(`Delete incident #${inc.id} "${inc.title}"?`)) return;
    this.updating = inc.id;

    this.incidentService.delete(inc.id).subscribe({
      next: () => {
        this.incidents = this.incidents.filter(i => i.id !== inc.id);
        this.updating  = null;
        this.totalElements--;
        this.showToast(`Incident #${inc.id} deleted`, 'success');
      },
      error: () => {
        this.updating = null;
        this.showToast('Failed to delete incident', 'error');
      }
    });
  }

  downloadWeeklyReport(): void {
    this.exportingReport = true;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    this.reportService.downloadPeriodReport(fromIso, toIso).subscribe({
      next: blob => {
        this.reportService.saveBlob(blob, `safecity-weekly-${fromIso}-${toIso}.pdf`);
        this.exportingReport = false;
        this.showToast('Weekly PDF report downloaded', 'success');
      },
      error: () => {
        this.exportingReport = false;
        this.showToast('Failed to export PDF report', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg  = msg;
    this.toastType = type;
    setTimeout(() => this.toastMsg = '', 3500);
  }
}
