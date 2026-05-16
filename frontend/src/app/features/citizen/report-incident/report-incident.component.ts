import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IncidentService } from '../../../core/services/incident.service';

@Component({
  selector: 'app-report-incident',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="report-page">
      <div class="report-card">
        <div class="card-header">
          <h1>🚨 Report an Incident</h1>
          <p>Help improve your city by reporting urban issues</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="report-form">
          <!-- Title -->
          <div class="form-group">
            <label for="title">Title *</label>
            <input id="title" formControlName="title" type="text"
                   placeholder="e.g. Large pothole on Main Street" class="form-control"
                   [class.error]="isInvalid('title')">
            <span class="error-msg" *ngIf="isInvalid('title')">Title is required</span>
          </div>

          <!-- Category -->
          <div class="form-group">
            <label for="category">Category</label>
            <select id="category" formControlName="category" class="form-control">
              <option value="">-- Select a category --</option>
              <option *ngFor="let cat of categories" [value]="cat.value">
                {{ cat.label }}
              </option>
            </select>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" formControlName="description" rows="3"
                      placeholder="Provide additional details..." class="form-control"></textarea>
          </div>

          <!-- GPS Location -->
          <div class="form-group">
            <label>📍 Location (Optional)</label>
            <button type="button" class="btn-locate" (click)="captureLocation()">
              <span *ngIf="!locationLoading">📡 Capture My GPS Location</span>
              <span *ngIf="locationLoading">⏳ Detecting location...</span>
            </button>
            <div *ngIf="locationCaptured" class="location-display">
              ✅ Lat: {{ form.value.latitude | number:'1.6-6' }},
                 Lng: {{ form.value.longitude | number:'1.6-6' }}
            </div>
            <div class="location-manual">
              <input formControlName="latitude" type="number" placeholder="Latitude"
                     class="form-control half" step="any">
              <input formControlName="longitude" type="number" placeholder="Longitude"
                     class="form-control half" step="any">
            </div>
            <input formControlName="address" type="text" placeholder="Street address (optional)"
                   class="form-control">
          </div>

          <!-- Photo Upload -->
          <div class="form-group">
            <label>📷 Photo</label>
            <div class="photo-drop-zone" [class.has-file]="selectedFile"
                 (click)="photoInput.click()" (dragover)="$event.preventDefault()"
                 (drop)="onDrop($event)">
              <ng-container *ngIf="!photoPreview">
                <span class="drop-icon">📁</span>
                <p>Drag & drop or click to upload</p>
                <small>JPEG / PNG / WEBP – max 10 MB</small>
              </ng-container>
              <img *ngIf="photoPreview" [src]="photoPreview" alt="Preview" class="photo-preview">
            </div>
            <input #photoInput type="file" accept="image/*" hidden (change)="onFileChange($event)">
          </div>

          <!-- AI Analysis indicator -->
          <div *ngIf="aiLoading" class="ai-badge" style="color: #4fc3f7; border-color: rgba(79,195,247,.3); background: rgba(79,195,247,.15);">
            ⏳ AI is analyzing your photo to auto-fill details...
          </div>
          <div *ngIf="!aiLoading && aiResult" class="ai-badge">
            🤖 AI auto-detected: <strong>{{ aiResult.aiCategory }}</strong>
            ({{ ((aiResult.aiConfidence ?? 0) * 100) | number:'1.0-1' }}% confidence). You may edit the fields above if incorrect.
          </div>

          <!-- Error / Success -->
          <div *ngIf="errorMsg" class="alert error">{{ errorMsg }}</div>
          <div *ngIf="successMsg" class="alert success">{{ successMsg }}</div>

          <!-- Submit -->
          <button type="submit" class="btn-submit" [disabled]="submitting || form.invalid">
            <span *ngIf="!submitting">Submit Report →</span>
            <span *ngIf="submitting">Submitting...</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .report-page {
      min-height:calc(100vh - 60px); display:flex; align-items:center;
      justify-content:center; padding:2rem 1rem;
      background: radial-gradient(ellipse at 30% 20%, #1a2a4a 0%, #0f0f1a 70%);
    }
    .report-card {
      width:100%; max-width:560px; background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08); border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.5); overflow:hidden;
    }
    .card-header {
      padding:2rem; background:linear-gradient(135deg,#1565c0,#0d47a1);
      text-align:center; color:#fff;
    }
    .card-header h1 { margin:0 0 .5rem; font-size:1.6rem; }
    .card-header p { margin:0; opacity:.8; }
    .report-form { padding:1.5rem 2rem 2rem; }

    .form-group { margin-bottom:1.2rem; }
    .form-group label { display:block; color:#ccc; font-size:.85rem; margin-bottom:.4rem; font-weight:500; }

    .form-control {
      width:100%; padding:.65rem .9rem; border-radius:8px;
      border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06);
      color:#fff; font-size:.95rem; transition:.2s; box-sizing:border-box;
    }
    .form-control:focus { outline:none; border-color:#4fc3f7; background:rgba(79,195,247,.08); }
    .form-control.error { border-color:#ef5350; }
    .form-control.half { width:calc(50% - .4rem); display:inline-block; margin-right:.4rem; margin-bottom:.5rem; }

    .error-msg { color:#ef5350; font-size:.8rem; }

    .btn-locate {
      width:100%; padding:.7rem; border-radius:8px; border:1px dashed rgba(79,195,247,.4);
      background:rgba(79,195,247,.06); color:#4fc3f7; cursor:pointer;
      font-size:.9rem; transition:.2s; margin-bottom:.6rem;
    }
    .btn-locate:hover { background:rgba(79,195,247,.12); }

    .location-display { color:#81c784; font-size:.85rem; margin-bottom:.6rem; }
    .location-manual { display:flex; gap:.5rem; margin-bottom:.5rem; }

    .photo-drop-zone {
      border:2px dashed rgba(255,255,255,.2); border-radius:10px;
      padding:2rem; text-align:center; cursor:pointer;
      transition:.2s; color:#888; background:rgba(255,255,255,.02);
    }
    .photo-drop-zone:hover, .photo-drop-zone.has-file { border-color:#4fc3f7; background:rgba(79,195,247,.06); }
    .drop-icon { font-size:2rem; }
    .photo-drop-zone p { margin:.5rem 0 0; font-size:.9rem; }
    .photo-preview { max-width:100%; max-height:180px; border-radius:8px; object-fit:cover; }

    .ai-badge {
      padding:.6rem 1rem; border-radius:8px; font-size:.85rem;
      background:rgba(171,71,188,.15); border:1px solid rgba(171,71,188,.3);
      color:#ce93d8; margin-bottom:1rem;
    }

    .alert { padding:.7rem 1rem; border-radius:8px; margin-bottom:1rem; font-size:.9rem; }
    .alert.error { background:rgba(239,83,80,.15); border:1px solid rgba(239,83,80,.3); color:#ef9a9a; }
    .alert.success { background:rgba(129,199,132,.15); border:1px solid rgba(129,199,132,.3); color:#a5d6a7; }

    .btn-submit {
      width:100%; padding:.85rem; border:none; border-radius:10px;
      background:linear-gradient(135deg,#1565c0,#0d47a1); color:#fff;
      font-size:1rem; font-weight:600; cursor:pointer; transition:.2s; letter-spacing:.5px;
    }
    .btn-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(21,101,192,.4); }
    .btn-submit:disabled { opacity:.5; cursor:not-allowed; }
  `]
})
export class ReportIncidentComponent implements OnInit {
  form!: FormGroup;
  selectedFile: File | null = null;
  photoPreview: string | null = null;
  locationLoading = false;
  locationCaptured = false;
  submitting = false;
  errorMsg = '';
  successMsg = '';
  aiResult: any = null;
  aiLoading = false;

  categories = [
    { value: 'POTHOLE',           label: '🕳️ Pothole' },
    { value: 'WATER_LEAK',        label: '💧 Water Leak' },
    { value: 'BROKEN_STREETLIGHT',label: '💡 Broken Streetlight' },
    { value: 'GRAFFITI',          label: '🎨 Graffiti' },
    { value: 'ILLEGAL_DUMPING',   label: '🗑️ Illegal Dumping' },
    { value: 'DAMAGED_SIGN',      label: '🚧 Damaged Sign' },
    { value: 'FLOODING',          label: '🌊 Flooding' },
    { value: 'OTHER',             label: '❓ Other' },
  ];

  constructor(
    private fb: FormBuilder,
    private incidentService: IncidentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title:       ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      category:    [''],
      latitude:    [null, [Validators.min(-90), Validators.max(90)]],
      longitude:   [null, [Validators.min(-180), Validators.max(180)]],
      address:     [''],
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  captureLocation(): void {
    if (!navigator.geolocation) {
      this.errorMsg = 'Geolocation is not supported by your browser.';
      return;
    }
    this.locationLoading = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.form.patchValue({
          latitude:  Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        this.locationLoading = false;
        this.locationCaptured = true;
      },
      err => {
        this.errorMsg = 'Could not detect location. Please enter manually.';
        this.locationLoading = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => this.photoPreview = e.target?.result as string;
    reader.readAsDataURL(file);

    // Call the AI in the background to auto-fill
    this.aiLoading = true;
    this.aiResult = null;
    this.incidentService.analyzeImage(file).subscribe({
      next: res => {
        this.aiLoading = false;
        
        const titleCtrl = this.form.get('title');
        const descCtrl = this.form.get('description');
        const catCtrl = this.form.get('category');

        const normalizedCategory = res.category?.toString().trim().toUpperCase().replace(/\s+/g, '_') || 'OTHER';
        const validCategory = this.categories.some(c => c.value === normalizedCategory)
          ? normalizedCategory
          : 'OTHER';

        const matchingCat = this.categories.find(c => c.value === validCategory);
        const categoryLabel = matchingCat
          ? matchingCat.label.replace(/[^a-zA-Z\s]/g, '').trim()
          : 'Other issue';

        // Auto-fill category, title and description when the image is uploaded.
        if (!catCtrl?.value) {
          catCtrl?.setValue(validCategory);
        }
        if (!titleCtrl?.value) {
          titleCtrl?.setValue(`Reported ${categoryLabel}`);
        }

        this.aiResult = { aiCategory: validCategory, aiConfidence: res.confidence };

        if (!descCtrl?.value) {
          this.incidentService.generateDescription(validCategory, res.confidence).subscribe({
            next: descRes => descCtrl?.setValue(descRes.description),
            error: err => {
              console.warn('AI description generation failed:', err);
              const conf = Math.round((res.confidence ?? 0) * 100);
              descCtrl?.setValue(`AI Auto-Detection: ${categoryLabel} with ${conf}% confidence.`);
            }
          });
        }
      },
      error: err => {
        this.aiLoading = false;
        this.errorMsg = 'AI image analysis failed. Please try again or enter the category manually.';
        console.error('AI analysis failed:', err);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting = true;
    this.errorMsg   = '';
    this.successMsg = '';

    const { title, description, category, latitude, longitude, address } = this.form.value;

    this.incidentService.createIncident(
      { title, description, category: category || undefined, latitude, longitude, address },
      this.selectedFile ?? undefined
    ).subscribe({
      next: res => {
        this.successMsg = `✅ Incident reported successfully! ID: ${res.id}`;
        this.aiResult   = res;
        this.submitting = false;
        setTimeout(() => this.router.navigate(['/citizen/my-reports']), 2000);
      },
      error: err => {
        this.errorMsg   = err.error?.message ?? 'Failed to submit report. Please try again.';
        this.submitting = false;
      }
    });
  }
}
