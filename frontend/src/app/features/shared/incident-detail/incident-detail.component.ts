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

        <!-- Department proof for non-moderation views -->
        <section class="card" *ngIf="incident.departmentFixPhotoPath && (!isAdmin || incident.status !== 'FIX_SUBMITTED')">
          <h2>Department proof</h2>
          <p *ngIf="incident.departmentFixSubmittedAt">Submitted {{ incident.departmentFixSubmittedAt | date:'short' }}</p>
          <img [src]="incidentService.photoUrl(incident.departmentFixPhotoPath)" alt="Department fix proof" class="photo" />
        </section>

        <!-- Admin actions for non-moderation states -->
        <section class="card" *ngIf="isAdmin && incident.status !== 'FIX_SUBMITTED'">
          <h2>Admin actions</h2>
          <div class="actions">
            <button *ngIf="incident.status === 'PENDING'" (click)="setStatus('VALIDATED')">Validate</button>
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
        </section>

        <!-- Department fix submission panel -->
        <section class="card" *ngIf="isDepartment && incident.status === 'ASSIGNED'">
          <h2>Submit fix proof</h2>
          <p *ngIf="incident.departmentReviewReason" class="reject-reason">{{ incident.departmentReviewReason }}</p>
          <input type="file" accept="image/*" (change)="onFixPhotoSelected($event)">
          <button class="submit-proof" (click)="submitFix()">Send photo for approval</button>
        </section>

        <!-- Admin Moderation & Comparative Photo Analysis Dashboard -->
        <section class="card full moderation-analysis-card" *ngIf="isAdmin && incident.status === 'FIX_SUBMITTED'">
          <div class="moderation-header">
            <h2>🔍 Moderation & Comparative Photo Analysis</h2>
            <div class="moderation-tabs">
              <button [class.active]="modMode === 'slider'" (click)="modMode = 'slider'">↔ Slider</button>
              <button [class.active]="modMode === 'side-by-side'" (click)="modMode = 'side-by-side'">📷 Side-by-Side</button>
              <button [class.active]="modMode === 'toggle'" (click)="modMode = 'toggle'">🔄 Toggle Overlay</button>
            </div>
          </div>

          <!-- Slider Mode -->
          <div class="mod-pane-container" *ngIf="modMode === 'slider'">
            <div class="before-after-slider">
              <!-- After Image (Background) -->
              <div class="slider-pane after-pane" [style.backgroundImage]="getSafeBgUrl(incidentService.photoUrl(incident.departmentFixPhotoPath))">
                <div class="badge-after">Après / After (Fix)</div>
              </div>

              <!-- Before Image (Overlay) -->
              <div class="slider-pane before-pane" [style.width.%]="sliderVal" [style.backgroundImage]="getSafeBgUrl(photoUrl)">
                <div class="badge-before">Avant / Before (Report)</div>
                <div class="no-photo-overlay" *ngIf="!photoUrl">
                  <span>📷 No original photo uploaded</span>
                </div>
              </div>

              <!-- Handle -->
              <div class="slider-handle" [style.left.%]="sliderVal">
                <div class="handle-button">↔</div>
              </div>

              <!-- Input -->
              <input type="range" min="0" max="100" class="slider-range-input" [(ngModel)]="sliderVal">
            </div>
            <p class="slider-instruction">← Drag the slider horizontally to compare the before and after photos →</p>
          </div>

          <!-- Side-by-Side Mode -->
          <div class="mod-pane-container side-by-side-grid" *ngIf="modMode === 'side-by-side'">
            <div class="photo-compare-pane before">
              <div class="pane-header red">⚠️ BEFORE (Original Report)</div>
              <div class="pane-img-box" *ngIf="photoUrl" [style.backgroundImage]="getSafeBgUrl(photoUrl)"></div>
              <div class="pane-img-box empty-photo" *ngIf="!photoUrl">
                <span class="no-photo-text">📷 No original photo uploaded</span>
              </div>
            </div>
            <div class="photo-compare-pane after">
              <div class="pane-header green">✅ AFTER (Department Fix Proof)</div>
              <div class="pane-img-box" [style.backgroundImage]="getSafeBgUrl(incidentService.photoUrl(incident.departmentFixPhotoPath))"></div>
            </div>
          </div>

          <!-- Toggle Mode -->
          <div class="mod-pane-container toggle-mode-container" *ngIf="modMode === 'toggle'">
            <div class="toggle-view-box" (click)="toggleOverlayImg()" 
                 [style.backgroundImage]="getSafeBgUrl(overlayState === 'before' ? photoUrl : incidentService.photoUrl(incident.departmentFixPhotoPath))">
              <div class="badge-before" *ngIf="overlayState === 'before'">Avant / Before (Report)</div>
              <div class="badge-after" *ngIf="overlayState === 'after'">Après / After (Fix)</div>
              <div class="no-photo-overlay" *ngIf="overlayState === 'before' && !photoUrl">
                <span>📷 No original photo uploaded</span>
              </div>
              <div class="click-to-toggle-overlay">Click image to toggle view</div>
            </div>
            <div class="toggle-controls">
              <button (click)="overlayState = 'before'" [class.active]="overlayState === 'before'">Show Before</button>
              <button (click)="overlayState = 'after'" [class.active]="overlayState === 'after'">Show After</button>
            </div>
          </div>

          <!-- Metadata Comparative Table -->
          <div class="meta-compare-table">
            <div class="table-row header">
              <div class="table-cell">Metric</div>
              <div class="table-cell">Original Report</div>
              <div class="table-cell">Department Fix</div>
            </div>
            <div class="table-row">
              <div class="table-cell label">Date / Time</div>
              <div class="table-cell">{{ incident.createdAt | date:'medium' }}</div>
              <div class="table-cell">{{ incident.departmentFixSubmittedAt | date:'medium' }}</div>
            </div>
            <div class="table-row">
              <div class="table-cell label">Author / Origin</div>
              <div class="table-cell">Citizen: {{ incident.reporterUsername }}</div>
              <div class="table-cell">Dept: {{ incident.assignedDepartment || 'N/A' }}</div>
            </div>
            <div class="table-row">
              <div class="table-cell label">Status Transition</div>
              <div class="table-cell"><span class="status-chip pending">{{ incident.status }}</span></div>
              <div class="table-cell">➡️ <span class="status-chip resolved">RESOLVED</span></div>
            </div>
          </div>

          <!-- Moderation Actions -->
          <div class="moderation-verdict-box">
            <h3>⚖️ Moderation Verdict</h3>
            <p>Carefully analyze the photos above. Does the submitted fix satisfy the issue reported by the citizen?</p>
            <div class="mod-action-buttons">
              <button class="btn-mod-approve" (click)="approveFix()">
                <span>✓</span> Approve Resolution & Close Ticket
              </button>
              <button class="btn-mod-refuse" (click)="showRefuseFix = true">
                <span>✗</span> Refuse Fix & Send Back to Department
              </button>
            </div>

            <!-- Refusal Box inline -->
            <div *ngIf="showRefuseFix" class="refuse-mod-box">
              <textarea [(ngModel)]="fixRefusalReason" placeholder="Describe what is missing or what needs to be fixed. This will be sent directly to the department..."></textarea>
              <div class="refuse-mod-actions">
                <button class="btn-confirm-refusal" (click)="refuseFix()" [disabled]="!fixRefusalReason.trim()">Confirm Refusal</button>
                <button class="btn-cancel-refusal" (click)="showRefuseFix = false">Cancel</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Citizen Star Rating Section -->
        <section class="card star-review-card" *ngIf="isCitizen && isReporter && incident.status === 'RESOLVED' && !incident.citizenRating">
          <h2>🌟 Rate Resolution</h2>
          <p class="section-subtitle">How satisfied are you with the resolution of this incident?</p>
          <div class="star-rating-container">
            <div class="stars-row" (mouseleave)="hoveredRating = 0">
              <span *ngFor="let s of [1,2,3,4,5]" 
                    class="star-icon" 
                    [class.filled]="s <= (hoveredRating || 0)"
                    (mouseenter)="hoveredRating = s"
                    (click)="rate(s)">
                ★
              </span>
            </div>
            <div class="rating-label" *ngIf="hoveredRating > 0">
              {{ getRatingLabel(hoveredRating) }}
            </div>
            <div class="rating-label placeholder" *ngIf="hoveredRating === 0">
              Select 1 to 5 stars
            </div>
          </div>
        </section>

        <!-- Pending Rating Section for Admins/Non-reporters -->
        <section class="card star-review-card rated" *ngIf="(!isCitizen || !isReporter) && incident.status === 'RESOLVED' && !incident.citizenRating">
          <h2>🌟 Citizen Rating</h2>
          <div class="star-rating-container read-only">
            <div class="stars-row">
              <span *ngFor="let s of [1,2,3,4,5]" class="star-icon static">★</span>
            </div>
            <div class="rating-text text-muted">
              This incident has not been rated by the citizen yet.
            </div>
          </div>
        </section>

        <section class="card star-review-card rated" *ngIf="incident.citizenRating">
          <h2>🌟 Resolution Rated</h2>
          <div class="star-rating-container read-only" *ngIf="!showReRateForm">
            <div class="stars-row">
              <span *ngFor="let s of [1,2,3,4,5]" 
                    class="star-icon static" 
                    [class.filled]="s <= incident.citizenRating">
                ★
              </span>
            </div>
            <div class="rating-text">
              <span *ngIf="isReporter">You rated this resolution: </span>
              <span *ngIf="!isReporter">The citizen rated this resolution: </span>
              <strong>{{ incident.citizenRating }}/5</strong> ({{ getRatingLabel(incident.citizenRating) }})
            </div>
            <div class="rated-date" *ngIf="incident.ratedAt">
              Rated on {{ incident.ratedAt | date:'mediumDate' }} at {{ incident.ratedAt | date:'shortTime' }}
            </div>
            <button class="btn-change-rating" *ngIf="isCitizen && isReporter" (click)="showReRateForm = true">
              ✏️ Change Rating
            </button>
          </div>

          <!-- Re-rate interactive form -->
          <div class="star-rating-container" *ngIf="showReRateForm">
            <div class="stars-row" (mouseleave)="hoveredRating = 0">
              <span *ngFor="let s of [1,2,3,4,5]" 
                    class="star-icon" 
                    [class.filled]="s <= (hoveredRating || 0)"
                    (mouseenter)="hoveredRating = s"
                    (click)="rate(s); showReRateForm = false">
                ★
              </span>
            </div>
            <div class="rating-label" *ngIf="hoveredRating > 0">
              {{ getRatingLabel(hoveredRating) }}
            </div>
            <div class="rating-label placeholder" *ngIf="hoveredRating === 0">
              Select 1 to 5 stars
            </div>
            <button class="btn-cancel-re-rate" (click)="showReRateForm = false">
              Cancel
            </button>
          </div>
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

    <!-- Customized Pop-up for Missing Photo -->
    <div class="custom-modal-overlay" *ngIf="showPhotoAlert">
      <div class="custom-modal">
        <h3>⚠️ Action requise</h3>
        <p>Veuillez sélectionner une photo comme preuve de résolution avant de soumettre.</p>
        <button (click)="showPhotoAlert = false">Compris</button>
      </div>
    </div>
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

    /* Star Review Widget */
    .star-review-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
      border: 1px solid rgba(255, 202, 40, 0.15);
      position: relative;
      overflow: hidden;
    }
    .star-review-card.rated {
      border-color: rgba(129, 199, 132, 0.2);
    }
    .star-review-card h2 {
      font-size: 1.15rem;
      margin-bottom: 0.35rem;
      color: #fff;
    }
    .section-subtitle {
      font-size: 0.85rem;
      color: var(--color-text-secondary);
      margin-bottom: 1.25rem;
    }
    .star-rating-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem 0;
    }
    .stars-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .star-icon {
      font-size: 2.25rem;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.15);
      transition: transform 0.15s ease, color 0.15s ease, text-shadow 0.15s ease;
      user-select: none;
    }
    .star-icon:hover {
      transform: scale(1.2);
    }
    .star-icon.filled {
      color: #ffca28;
      text-shadow: 0 0 12px rgba(255, 202, 40, 0.6);
    }
    .star-icon.static {
      cursor: default;
    }
    .star-icon.static:hover {
      transform: none;
    }
    .rating-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #ffca28;
      height: 1.2rem;
      animation: fadeIn 0.2s ease both;
    }
    .rating-label.placeholder {
      color: var(--color-text-muted);
      font-weight: normal;
    }
    .rating-text {
      font-size: 0.95rem;
      color: #fff;
      margin-top: 0.25rem;
    }
    .rated-date {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.4rem;
    }

    /* Moderation panel */
    .moderation-analysis-card {
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 15, 26, 0.95) 100%);
      border: 1px solid rgba(79, 195, 247, 0.2);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      margin-top: 1.5rem;
    }
    .moderation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .moderation-header h2 {
      font-size: 1.25rem;
      color: #fff;
    }
    .moderation-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      padding: 3px;
    }
    .moderation-tabs button {
      background: transparent;
      border: none;
      color: #aaa;
      padding: 0.4rem 0.85rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .moderation-tabs button.active {
      background: #4fc3f7;
      color: #0f0f1a;
      box-shadow: 0 2px 8px rgba(79, 195, 247, 0.3);
    }
    .mod-pane-container {
      margin-bottom: 1.5rem;
      animation: fadeIn 0.25s ease both;
    }
    .slider-instruction {
      text-align: center;
      font-size: 0.78rem;
      color: #888;
      margin-top: 0.5rem;
    }

    /* Slider styling */
    .before-after-slider {
      position: relative;
      width: 100%;
      height: 380px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      user-select: none;
    }
    .slider-pane {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
    }
    .before-pane {
      border-right: 2px solid #fff;
      z-index: 2;
      overflow: hidden;
    }
    .badge-before, .badge-after {
      position: absolute;
      bottom: 12px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      z-index: 5;
      letter-spacing: 0.5px;
    }
    .badge-before {
      left: 12px;
      background: #ef5350;
      color: #fff;
    }
    .badge-after {
      right: 12px;
      background: #81c784;
      color: #fff;
    }
    .slider-handle {
      position: absolute;
      top: 0;
      height: 100%;
      width: 2px;
      background: #fff;
      z-index: 3;
      pointer-events: none;
      transform: translateX(-50%);
    }
    .handle-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      background: #fff;
      color: #0f0f1a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    .slider-range-input {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: col-resize;
      z-index: 4;
      margin: 0;
    }

    /* Side by side grid */
    .side-by-side-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .photo-compare-pane {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      overflow: hidden;
    }
    .pane-header {
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .pane-header.red {
      background: rgba(239, 83, 80, 0.15);
      color: #ef5350;
    }
    .pane-header.green {
      background: rgba(129, 199, 132, 0.15);
      color: #81c784;
    }
    .pane-img-box {
      width: 100%;
      height: 300px;
      background-size: cover;
      background-position: center;
    }
    .pane-img-box.empty-photo {
      background: #1a1a2e;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .no-photo-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #1a1a2e;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 0.95rem;
      font-weight: 500;
      white-space: nowrap;
      z-index: 1;
    }

    /* Toggle Mode */
    .toggle-mode-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .toggle-view-box {
      position: relative;
      width: 100%;
      height: 350px;
      max-width: 600px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      cursor: pointer;
      background-size: cover;
      background-position: center;
      transition: filter 0.15s ease;
    }
    .toggle-view-box:hover {
      filter: brightness(1.05);
    }
    .click-to-toggle-overlay {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 0.7rem;
      padding: 3px 8px;
      border-radius: 4px;
      pointer-events: none;
    }
    .toggle-controls {
      display: flex;
      gap: 0.5rem;
    }
    .toggle-controls button {
      padding: 0.4rem 1rem;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #fff;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .toggle-controls button.active {
      border-color: #4fc3f7;
      background: rgba(79, 195, 247, 0.12);
      color: #4fc3f7;
    }

    /* Meta compare table */
    .meta-compare-table {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      margin-bottom: 1.5rem;
    }
    .table-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding: 0.6rem 0.85rem;
    }
    .table-row.header {
      background: rgba(255, 255, 255, 0.04);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    .table-row:last-child {
      border-bottom: none;
    }
    .table-cell {
      font-size: 0.85rem;
    }
    .table-cell.label {
      font-weight: 500;
      color: #aaa;
    }

    /* Moderation verdict */
    .moderation-verdict-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 1.25rem;
      border-left: 4px solid #ffca28;
    }
    .moderation-verdict-box h3 {
      font-size: 1rem;
      margin-bottom: 0.35rem;
    }
    .moderation-verdict-box p {
      font-size: 0.85rem;
      color: #aaa;
      margin-bottom: 1.25rem;
    }
    .mod-action-buttons {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-mod-approve, .btn-mod-refuse {
      flex: 1;
      min-width: 200px;
      padding: 0.75rem 1.25rem;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn-mod-approve {
      background: #2e7d32;
    }
    .btn-mod-approve:hover {
      transform: translateY(-1px);
    }
    .btn-mod-refuse {
      background: #c62828;
    }
    .btn-mod-refuse:hover {
      transform: translateY(-1px);
    }
    .refuse-mod-box {
      margin-top: 1rem;
      display: grid;
      gap: 0.75rem;
      animation: fadeIn 0.2s ease both;
    }
    .refuse-mod-box textarea {
      width: 100%;
      min-height: 80px;
      background: #1a1a2e;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 0.6rem;
      font-family: inherit;
      font-size: 0.85rem;
    }
    .refuse-mod-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .btn-confirm-refusal {
      background: #c62828 !important;
    }
    .btn-confirm-refusal:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-cancel-refusal {
      background: transparent !important;
      border: none !important;
      color: #aaa !important;
      cursor: pointer;
    }
    .btn-change-rating {
      margin-top: 0.75rem;
      padding: 0.35rem 0.75rem;
      border: 1px solid rgba(79, 195, 247, 0.3);
      background: rgba(79, 195, 247, 0.08);
      color: #4fc3f7;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: 0.2s;
    }
    .btn-change-rating:hover {
      background: rgba(79, 195, 247, 0.18);
    }
    .btn-cancel-re-rate {
      margin-top: 0.5rem;
      background: transparent;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .custom-modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(3px); }
    .custom-modal { background:#1e1e2f; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:1.8rem; max-width:320px; text-align:center; box-shadow:0 15px 35px rgba(0,0,0,0.5); }
    .custom-modal h3 { color:#ffca28; margin-top:0; font-size:1.2rem; }
    .custom-modal p { color:#c4ccd8; margin:1rem 0 1.5rem; line-height:1.5; font-size:0.95rem; }
    .custom-modal button { background:#4fc3f7; color:#0f0f1a; border:none; padding:0.6rem 1.5rem; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; transition:background 0.2s; }
    .custom-modal button:hover { background:#29b6f6; }
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
  isReporter = false;
  showReRateForm = false;
  fixPhoto?: File;
  assignmentNote = '';
  assignedDepartment = 'Roads';
  departments = ['Roads', 'Water', 'Lighting', 'Waste', 'Parks', 'Traffic'];
  showPhotoAlert = false;

  // Star Review & Moderation variables
  hoveredRating = 0;
  modMode: 'slider' | 'side-by-side' | 'toggle' = 'slider';
  sliderVal = 50;
  overlayState: 'before' | 'after' = 'before';

  toggleOverlayImg(): void {
    this.overlayState = this.overlayState === 'before' ? 'after' : 'before';
  }

  getSafeBgUrl(url: string | null | undefined): string {
    return url ? `url('${url}')` : 'none';
  }

  getRatingLabel(rating: number): string {
    switch(rating) {
      case 1: return "Poor - Unacceptable resolution";
      case 2: return "Fair - Needs improvement";
      case 3: return "Good - Satisfactory work";
      case 4: return "Very Good - High quality work";
      case 5: return "Excellent - Outstanding job";
      default: return "";
    }
  }

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
        this.isReporter = inc.reporterKeycloakId === this.auth.getIdentityClaims()?.['sub'];
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
    if (!this.incident) return;
    if (!this.fixPhoto) {
      this.showPhotoAlert = true;
      return;
    }
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
