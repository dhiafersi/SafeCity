import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IncidentResponse, IncidentService, PageResponse } from '../../../core/services/incident.service';

@Component({
  selector: 'app-department-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="department-page">
      <header>
        <h1>Department work queue</h1>
        <button (click)="load()" [disabled]="loading">Refresh</button>
      </header>

      <div class="loading" *ngIf="loading">Loading assigned incidents...</div>

      <div class="queue" *ngIf="!loading && incidents.length">
        <article class="item" *ngFor="let incident of incidents">
          <div class="summary">
            <span class="status" [class]="incident.status.toLowerCase()">{{ incident.status }}</span>
            <h2>#{{ incident.id }} {{ incident.title }}</h2>
            <p>{{ incident.description || 'No description provided.' }}</p>
            <small>{{ incident.address || (incident.latitude + ', ' + incident.longitude) }}</small>
            <p class="review" *ngIf="incident.departmentReviewReason">
              Admin refusal: {{ incident.departmentReviewReason }}
            </p>
          </div>

          <div class="proof">
            <img *ngIf="incident.departmentFixPhotoPath" [src]="photoUrl(incident.departmentFixPhotoPath)" alt="Fix proof">
            <ng-container *ngIf="incident.status === 'ASSIGNED'">
              <input type="file" accept="image/*" (change)="onFileSelected(incident.id, $event)">
              <button (click)="submitFix(incident)" [disabled]="updating === incident.id">
                Submit fix photo
              </button>
            </ng-container>
            <p *ngIf="incident.status === 'FIX_SUBMITTED'" class="waiting">
              Waiting for admin approval.
            </p>
            <a [routerLink]="['/department/incidents', incident.id]">Open details</a>
          </div>
        </article>
      </div>

      <div class="empty" *ngIf="!loading && !incidents.length">No assigned incidents yet.</div>
    <div class="toast" *ngIf="toastMsg" [class]="toastType">{{ toastMsg }}</div>

    <!-- Customized Pop-up for Missing Photo -->
    <div class="custom-modal-overlay" *ngIf="showPhotoAlert">
      <div class="custom-modal">
        <h3>⚠️ Action requise</h3>
        <p>Veuillez sélectionner une photo comme preuve de résolution avant de soumettre.</p>
        <button (click)="showPhotoAlert = false">Compris</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .department-page { padding:1.5rem; background:#0f0f1a; color:#fff; min-height:calc(100vh - 60px); }
    header { display:flex; align-items:center; gap:1rem; margin-bottom:1rem; }
    h1 { margin:0; font-size:1.35rem; flex:1; }
    header button, .proof button {
      padding:.45rem .85rem; border-radius:8px; border:1px solid rgba(79,195,247,.3);
      background:rgba(79,195,247,.12); color:#9bdcf8; cursor:pointer;
    }
    .queue { display:grid; gap:.8rem; }
    .item {
      display:grid; grid-template-columns:1fr 18rem; gap:1rem; padding:1rem;
      border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); border-radius:8px;
    }
    h2 { margin:.35rem 0; font-size:1rem; }
    p { color:#c4ccd8; line-height:1.45; }
    small { color:#8d98a8; }
    .status { display:inline-flex; width:max-content; padding:.15rem .55rem; border-radius:999px; font-size:.68rem; font-weight:800; }
    .status.assigned { background:rgba(255,202,40,.16); color:#ffca28; }
    .status.fix_submitted { background:rgba(79,195,247,.16); color:#4fc3f7; }
    .status.resolved { background:rgba(129,199,132,.16); color:#81c784; }
    .proof { display:flex; flex-direction:column; gap:.65rem; align-items:flex-start; }
    .proof img { width:100%; max-height:10rem; object-fit:cover; border-radius:8px; }
    input { color:#cbd5e1; max-width:100%; }
    a { color:#9bdcf8; text-decoration:none; }
    .review { color:#ffb4ad; }
    .waiting, .loading, .empty { color:#8d98a8; }
    .toast { position:fixed; right:1rem; bottom:1rem; padding:.75rem 1rem; border-radius:8px; z-index:999; }
    .toast.success { background:#1b5e20; color:#c8e6c9; }
    .toast.error { background:#7f0000; color:#ffb4ad; }
    @media (max-width:800px) { .item { grid-template-columns:1fr; } }
    .custom-modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(3px); }
    .custom-modal { background:#1e1e2f; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:1.8rem; max-width:320px; text-align:center; box-shadow:0 15px 35px rgba(0,0,0,0.5); }
    .custom-modal h3 { color:#ffca28; margin-top:0; font-size:1.2rem; }
    .custom-modal p { color:#c4ccd8; margin:1rem 0 1.5rem; line-height:1.5; font-size:0.95rem; }
    .custom-modal button { background:#4fc3f7; color:#0f0f1a; border:none; padding:0.6rem 1.5rem; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; transition:background 0.2s; }
    .custom-modal button:hover { background:#29b6f6; }
  `]
})
export class DepartmentIncidentsComponent implements OnInit {
  incidents: IncidentResponse[] = [];
  selectedFiles: Record<number, File | undefined> = {};
  loading = true;
  updating: number | null = null;
  toastMsg = '';
  toastType: 'success' | 'error' = 'success';
  showPhotoAlert = false;

  constructor(private incidentService: IncidentService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.incidentService.getDepartmentIncidents().subscribe({
      next: (page: PageResponse<IncidentResponse>) => {
        this.incidents = page.content;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load department queue', 'error');
      }
    });
  }

  onFileSelected(id: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFiles[id] = input.files?.[0];
  }

  submitFix(incident: IncidentResponse): void {
    const file = this.selectedFiles[incident.id];
    if (!file) {
      this.showPhotoAlert = true;
      return;
    }

    this.updating = incident.id;
    this.incidentService.submitDepartmentFix(incident.id, file).subscribe({
      next: updated => {
        this.replaceIncident(updated);
        this.selectedFiles[incident.id] = undefined;
        this.updating = null;
        this.showToast('Fix photo sent for admin review', 'success');
      },
      error: () => {
        this.updating = null;
        this.showToast('Failed to submit fix photo', 'error');
      }
    });
  }

  photoUrl(filename?: string): string | null {
    return this.incidentService.photoUrl(filename);
  }

  private replaceIncident(updated: IncidentResponse): void {
    const index = this.incidents.findIndex(i => i.id === updated.id);
    if (index >= 0) this.incidents[index] = updated;
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg = msg;
    this.toastType = type;
    setTimeout(() => this.toastMsg = '', 3000);
  }
}
