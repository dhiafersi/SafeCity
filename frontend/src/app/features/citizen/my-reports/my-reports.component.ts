import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncidentService, IncidentResponse, PageResponse } from '../../../core/services/incident.service';

@Component({
  selector: 'app-my-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reports-page">
      <div class="reports-container">
        <h1>📋 My Incident Reports</h1>

        <div class="loading" *ngIf="loading">Loading your reports...</div>
        <div class="empty" *ngIf="!loading && incidents.length === 0">
          <p>You haven't submitted any reports yet.</p>
        </div>

        <div class="incidents-grid" *ngIf="incidents.length > 0">
          <div class="incident-card" *ngFor="let inc of incidents">
            <div class="card-top">
              <span class="status-chip" [class]="inc.status.toLowerCase()">{{ inc.status }}</span>
              <span class="category">{{ inc.category || 'Uncategorized' }}</span>
            </div>
            <h3>{{ inc.title }}</h3>
            <p class="description">{{ inc.description || '—' }}</p>
            <div class="meta">
              <span>📍 {{ inc.latitude | number:'1.4-4' }}, {{ inc.longitude | number:'1.4-4' }}</span>
              <span>🕐 {{ inc.createdAt | date:'short' }}</span>
            </div>
            <div class="ai-info" *ngIf="inc.aiCategory">
              🤖 AI: <strong>{{ inc.aiCategory }}</strong> ({{ ((inc.aiConfidence ?? 0) * 100) | number:'1.0-1' }}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reports-page {
      min-height:calc(100vh - 60px); padding:2rem 1rem;
      background:radial-gradient(ellipse at 50% 10%, #1a1a3a 0%, #0f0f1a 70%);
      color:#fff;
    }
    .reports-container { max-width:800px; margin:0 auto; }
    h1 { margin-bottom:1.5rem; font-size:1.5rem; }
    .loading, .empty { color:#888; text-align:center; padding:3rem; }

    .incidents-grid { display:flex; flex-direction:column; gap:1rem; }
    .incident-card {
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
      border-radius:12px; padding:1.25rem 1.5rem; transition:.2s;
    }
    .incident-card:hover { border-color:rgba(79,195,247,.3); background:rgba(79,195,247,.04); }

    .card-top { display:flex; align-items:center; gap:.75rem; margin-bottom:.75rem; }
    .status-chip {
      font-size:.7rem; font-weight:700; padding:.2rem .65rem;
      border-radius:20px; text-transform:uppercase; letter-spacing:.5px;
    }
    .status-chip.pending   { background:rgba(255,193,7,.15); color:#ffca28; border:1px solid rgba(255,193,7,.3); }
    .status-chip.validated { background:rgba(129,199,132,.15); color:#81c784; border:1px solid rgba(129,199,132,.3); }
    .status-chip.resolved  { background:rgba(79,195,247,.15); color:#4fc3f7; border:1px solid rgba(79,195,247,.3); }

    .category { font-size:.8rem; color:#888; }
    h3 { margin:0 0 .4rem; font-size:1rem; }
    .description { color:#aaa; font-size:.85rem; margin:0 0 .75rem; }
    .meta { display:flex; gap:1rem; font-size:.8rem; color:#777; flex-wrap:wrap; }
    .ai-info { margin-top:.5rem; font-size:.8rem; color:#ce93d8; }
  `]
})
export class MyReportsComponent implements OnInit {
  incidents: IncidentResponse[] = [];
  loading = true;

  constructor(private incidentService: IncidentService) {}

  ngOnInit(): void {
    this.incidentService.getMyIncidents().subscribe({
      next: (page: PageResponse<IncidentResponse>) => { this.incidents = page.content; this.loading = false; },
      error: () => this.loading = false
    });
  }
}
