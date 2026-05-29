import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AuditLogResponse,
  CommentResponse,
  IncidentResponse,
  IncidentService
} from '../../../core/services/incident.service';
import { ReportService } from '../../../core/services/report.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="detail-page" *ngIf="incident">
      <header class="detail-header">
        <a [routerLink]="backLink" class="back">Back</a>
        <h1>#{{ incident.id }} - {{ incident.title }}</h1>
        <span class="status-chip" [class]="incident.status.toLowerCase()">{{ incident.status }}</span>
        <span class="sla-badge overdue" *ngIf="incident.slaOverdue">SLA overdue</span>
        <span class="sla-badge" *ngIf="incident.slaDeadlineAt && !incident.slaOverdue">
          SLA: {{ incident.slaDeadlineAt | date:'short' }}
        </span>
        <button *ngIf="isAdmin" class="btn-pdf" (click)="downloadDossier()">PDF dossier</button>
      </header>

      <div class="grid">
        <section class="card">
          <h2>Details</h2>
          <p>{{ incident.description || '-' }}</p>
          <p><strong>Category:</strong> {{ incident.category || '-' }}</p>
          <p><strong>Reporter:</strong> {{ incident.reporterUsername }}</p>
          <p><strong>Location:</strong> {{ incident.address || (incident.latitude + ', ' + incident.longitude) }}</p>
          <p *ngIf="incident.assignedDepartment"><strong>Assigned department:</strong> {{ incident.assignedDepartment }}</p>
          <p *ngIf="incident.departmentReviewReason" class="reject-reason"><strong>Fix refused:</strong> {{ incident.departmentReviewReason }}</p>
          <p *ngIf="incident.duplicateOfIncidentId"><strong>Possible duplicate of:</strong> #{{ incident.duplicateOfIncidentId }}</p>
          <p *ngIf="incident.rejectionReason" class="reject-reason"><strong>Rejection:</strong> {{ incident.rejectionReason }}</p>
          <img *ngIf="photoUrl" [src]="photoUrl" alt="Incident photo" class="photo" />
        </section>

        <section class="card" *ngIf="incident.departmentFixPhotoPath">
          <h2>Department proof</h2>
          <p *ngIf="incident.departmentFixSubmittedAt">Submitted {{ incident.departmentFixSubmittedAt | date:'short' }}</p>
          <img [src]="incidentService.photoUrl(incident.departmentFixPhotoPath)" alt="Department fix proof" class="photo" />
        </section>

        <section class="card" *ngIf="isAdmin">
          <h2>Admin actions</h2>
          <div class="actions">
            <button *ngIf="incident.status === 'PENDING'" (click)="setStatus('VALIDATED')">Validate</button>
            <button *ngIf="incident.status === 'FIX_SUBMITTED'" (click)="approveFix()">Approve fix</button>
            <button *ngIf="incident.status === 'FIX_SUBMITTED'" (click)="showRefuseFix = true">Refuse fix</button>
            <button *ngIf="incident.status === 'PENDING'" (click)="showReject = true">Reject</button>
          </div>

          <div class="assign-box" *ngIf="incident.status === 'VALIDATED' || incident.status === 'ASSIGNED'">
            <label>
              Department
              <select [(ngModel)]="assignedDepartment">
                <option *ngFor="let department of departments" [value]="department">{{ department }}</option>
              </select>
            </label>
            <textarea [(ngModel)]="assignmentNote" placeholder="Instructions for the department"></textarea>
            <button (click)="assignDepartment()" [disabled]="!assignedDepartment">Send to department</button>
          </div>

          <div *ngIf="showReject" class="reject-box">
            <textarea [(ngModel)]="rejectReason" placeholder="Rejection reason (required)"></textarea>
            <button (click)="reject()">Confirm reject</button>
            <button class="muted-btn" (click)="showReject = false">Cancel</button>
          </div>

          <div *ngIf="showRefuseFix" class="reject-box">
            <textarea [(ngModel)]="fixRefusalReason" placeholder="Tell the department what still needs to be fixed"></textarea>
            <button (click)="refuseFix()">Confirm refusal</button>
            <button class="muted-btn" (click)="showRefuseFix = false">Cancel</button>
          </div>
        </section>

        <section class="card" *ngIf="isDepartment && incident.status === 'ASSIGNED'">
          <h2>Submit fix proof</h2>
          <p *ngIf="incident.departmentReviewReason" class="reject-reason">{{ incident.departmentReviewReason }}</p>
          <input type="file" accept="image/*" (change)="onFixPhotoSelected($event)">
          <button class="submit-proof" (click)="submitFix()" [disabled]="!fixPhoto">Send photo for approval</button>
        </section>

        <section class="card" *ngIf="isCitizen && incident.status === 'RESOLVED' && !incident.citizenRating">
          <h2>Rate resolution</h2>
          <div class="stars">
            <button *ngFor="let s of [1,2,3,4,5]" (click)="rate(s)">{{ s }} stars</button>
          </div>
        </section>

        <section class="card" *ngIf="incident.citizenRating">
          <p>Your rating: {{ incident.citizenRating }}/5</p>
        </section>

        <section class="card full">
          <h2>Timeline</h2>
          <div class="timeline" *ngIf="audit.length; else noAudit">
            <div class="timeline-item" *ngFor="let e of audit">
              <span class="time">{{ e.createdAt | date:'short' }}</span>
              <strong>{{ e.actionType }}</strong>
              <span *ngIf="e.actorUsername"> - {{ e.actorUsername }}</span>
              <p *ngIf="e.note">{{ e.note }}</p>
              <small *ngIf="e.oldValue">{{ e.oldValue }} -> {{ e.newValue }}</small>
            </div>
          </div>
          <ng-template #noAudit><p class="muted">No events yet.</p></ng-template>
        </section>

        <section class="card full">
          <h2>Comments</h2>
          <div class="comment" *ngFor="let c of comments">
            <strong>{{ c.authorUsername }} ({{ c.authorRole }})</strong>
            <span class="time">{{ c.createdAt | date:'short' }}</span>
            <p>{{ c.body }}</p>
          </div>
          <div class="comment-form">
            <textarea [(ngModel)]="newComment" placeholder="Add a note"></textarea>
            <button (click)="postComment()" [disabled]="!newComment.trim()">Post</button>
          </div>
        </section>
      </div>
    </div>
    <div class="loading" *ngIf="loading">Loading...</div>
  `,
  styles: [`
    .detail-page { padding:1.5rem; background:#0f0f1a; min-height:calc(100vh - 60px); color:#fff; }
    .detail-header { display:flex; flex-wrap:wrap; align-items:center; gap:.75rem; margin-bottom:1.5rem; }
    .detail-header h1 { margin:0; font-size:1.2rem; flex:1; min-width:200px; }
    .back { color:#4fc3f7; text-decoration:none; }
    .status-chip { font-size:.7rem; font-weight:700; padding:.2rem .65rem; border-radius:20px; text-transform:uppercase; }
    .status-chip.pending { background:rgba(255,193,7,.15); color:#ffca28; }
    .status-chip.validated { background:rgba(129,199,132,.15); color:#81c784; }
    .status-chip.assigned { background:rgba(255,202,40,.15); color:#ffca28; }
    .status-chip.fix_submitted { background:rgba(79,195,247,.15); color:#4fc3f7; }
    .status-chip.resolved { background:rgba(129,199,132,.15); color:#81c784; }
    .status-chip.rejected { background:rgba(239,83,80,.15); color:#ef5350; }
    .sla-badge { font-size:.75rem; color:#ffca28; }
    .sla-badge.overdue { color:#ef5350; font-weight:700; }
    .btn-pdf { padding:.4rem .9rem; border-radius:8px; border:1px solid rgba(79,195,247,.4); background:rgba(79,195,247,.1); color:#4fc3f7; cursor:pointer; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .card { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:1rem; }
    .card.full { grid-column:1 / -1; }
    .photo { max-width:100%; border-radius:8px; margin-top:.75rem; }
    .actions { display:flex; gap:.5rem; flex-wrap:wrap; }
    .actions button, .assign-box button, .reject-box button, .submit-proof {
      padding:.45rem .8rem; border-radius:8px; border:1px solid rgba(255,255,255,.15);
      background:rgba(255,255,255,.06); color:#fff; cursor:pointer;
    }
    .assign-box, .reject-box { margin-top:.75rem; display:grid; gap:.5rem; }
    .assign-box label { display:grid; gap:.35rem; color:#dce8f2; font-size:.85rem; }
    .assign-box select, .assign-box textarea, .reject-box textarea, .comment-form textarea {
      width:100%; background:#1a1a2e; color:#fff; border:1px solid rgba(255,255,255,.12);
      border-radius:8px; padding:.5rem;
    }
    .assign-box textarea, .reject-box textarea { min-height:60px; }
    .reject-reason { color:#ef9a9a; }
    .muted-btn { color:#aaa !important; }
    .stars button { margin-right:.35rem; padding:.35rem .6rem; cursor:pointer; border-radius:6px; border:1px solid rgba(255,193,7,.3); background:transparent; color:#ffca28; }
    .timeline-item { padding:.5rem 0; border-bottom:1px solid rgba(255,255,255,.06); }
    .time { color:#888; font-size:.75rem; margin-right:.5rem; }
    .comment { padding:.5rem 0; border-bottom:1px solid rgba(255,255,255,.06); }
    .comment .time { float:right; color:#666; font-size:.75rem; }
    .comment-form textarea { min-height:50px; }
    .comment-form button { margin-top:.5rem; padding:.4rem 1rem; border-radius:8px; background:#4fc3f7; color:#0f0f1a; border:none; cursor:pointer; }
    .muted { color:#888; }
    .loading { padding:3rem; text-align:center; color:#888; }
    input { color:#cbd5e1; display:block; margin:.5rem 0; }
    @media (max-width:768px) { .grid { grid-template-columns:1fr; } }
  `]
})
export class IncidentDetailComponent implements OnInit {
  incident?: IncidentResponse;
  audit: AuditLogResponse[] = [];
  comments: CommentResponse[] = [];
  loading = true;
  showReject = false;
  showRefuseFix = false;
  rejectReason = '';
  fixRefusalReason = '';
  newComment = '';
  photoUrl: string | null = null;
  backLink = '/';
  isAdmin = false;
  isCitizen = false;
  isDepartment = false;
  fixPhoto?: File;
  assignmentNote = '';
  assignedDepartment = 'Roads';
  departments = ['Roads', 'Water', 'Lighting', 'Waste', 'Parks', 'Traffic'];

  constructor(
    private route: ActivatedRoute,
    public incidentService: IncidentService,
    private reportService: ReportService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.hasRole('ADMIN');
    this.isCitizen = this.auth.hasRole('CITIZEN');
    this.isDepartment = this.auth.hasRole('DEPARTMENT');
    this.backLink = this.isAdmin ? '/admin/incidents' : (this.isDepartment ? '/department/incidents' : '/citizen/my-reports');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  private load(id: number): void {
    this.incidentService.getById(id).subscribe({
      next: inc => {
        this.incident = inc;
        this.photoUrl = this.incidentService.photoUrl(inc.photoPath);
        this.assignedDepartment = inc.assignedDepartment || this.assignedDepartment;
        this.loading = false;
      },
      error: () => this.loading = false
    });
    this.incidentService.getAudit(id).subscribe(a => this.audit = a);
    this.incidentService.getComments(id).subscribe(c => this.comments = c);
  }

  setStatus(status: 'VALIDATED' | 'RESOLVED'): void {
    if (!this.incident) return;
    this.incidentService.updateStatus(this.incident.id, { status }).subscribe(inc => {
      this.incident = inc;
      this.load(this.incident.id);
    });
  }

  assignDepartment(): void {
    if (!this.incident || !this.assignedDepartment) return;
    this.incidentService.assignDepartment(this.incident.id, this.assignedDepartment, this.assignmentNote).subscribe(inc => {
      this.incident = inc;
      this.assignmentNote = '';
      this.load(this.incident.id);
    });
  }

  approveFix(): void {
    if (!this.incident) return;
    this.incidentService.approveDepartmentFix(this.incident.id).subscribe(inc => {
      this.incident = inc;
      this.load(this.incident.id);
    });
  }

  refuseFix(): void {
    if (!this.incident || !this.fixRefusalReason.trim()) return;
    this.incidentService.refuseDepartmentFix(this.incident.id, this.fixRefusalReason.trim()).subscribe(inc => {
      this.incident = inc;
      this.fixRefusalReason = '';
      this.showRefuseFix = false;
      this.load(this.incident.id);
    });
  }

  onFixPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fixPhoto = input.files?.[0];
  }

  submitFix(): void {
    if (!this.incident || !this.fixPhoto) return;
    this.incidentService.submitDepartmentFix(this.incident.id, this.fixPhoto).subscribe(inc => {
      this.incident = inc;
      this.fixPhoto = undefined;
      this.load(this.incident.id);
    });
  }

  reject(): void {
    if (!this.incident || !this.rejectReason.trim()) return;
    this.incidentService.reject(this.incident.id, this.rejectReason.trim()).subscribe(inc => {
      this.incident = inc;
      this.showReject = false;
      this.load(this.incident!.id);
    });
  }

  rate(stars: number): void {
    if (!this.incident) return;
    this.incidentService.rate(this.incident.id, stars).subscribe(inc => this.incident = inc);
  }

  postComment(): void {
    if (!this.incident || !this.newComment.trim()) return;
    this.incidentService.addComment(this.incident.id, this.newComment.trim()).subscribe(c => {
      this.comments = [...this.comments, c];
      this.newComment = '';
    });
  }

  downloadDossier(): void {
    if (!this.incident) return;
    this.reportService.downloadIncidentDossier(this.incident.id).subscribe(blob => {
      this.reportService.saveBlob(blob, `incident-${this.incident!.id}.pdf`);
    });
  }
}
