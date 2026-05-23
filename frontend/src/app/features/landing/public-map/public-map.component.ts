import { AfterViewInit, Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  Map as LeafletMap,
  LayerGroup,
  map as createMap,
  tileLayer,
  layerGroup,
  divIcon,
  marker,
} from 'leaflet';
import { IncidentResponse, PageResponse } from '../../../core/services/incident.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { GamificationService, CitizenPointsResponse } from '../../../core/services/gamification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Observable } from 'rxjs';
import { TransparencyService, TransparencyStats } from '../../../core/services/transparency.service';

@Component({
  selector: 'app-public-map',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="landing-shell">
      <!-- Hero overlay content -->
      <header class="hero" *ngIf="!(isLoggedIn$ | async)">
        <div class="hero-copy">
          <h1>See your city in real time.</h1>
          <p>Explore live incident reports and urban issues directly on the map — no login required.</p>
        </div>
        <div class="hero-pill">
          <div class="stat">
            <span class="label">Live incidents</span>
            <span class="value">{{ filteredIncidents.length }}</span>
          </div>
          <div class="divider"></div>
          <div class="stat">
            <span class="label">Pending</span>
            <span class="value pending">{{ pendingCount }}</span>
          </div>
          <div class="stat">
            <span class="label">Resolved</span>
            <span class="value resolved">{{ resolvedCount }}</span>
          </div>
        </div>
      </header>

      <!-- Floating helper text (bottom left) -->
      <div class="helper-card">
        <h2>Interact with the map</h2>
        <ul>
          <li>Zoom & pan to explore different areas.</li>
          <li>Click markers to see incident details.</li>
          <li>Sign in later to report or track your own incidents.</li>
        </ul>
      </div>

      <!-- Leaderboard (right side) -->
      <aside class="leaderboard-card">
        <h2>Top Contributors</h2>
        <p class="subtitle">Viewing {{ currentGovernorate }} • {{ filteredIncidents.length }} incidents shown</p>
        <div *ngIf="leaderboardLoading" class="lb-loading">Loading leaderboard…</div>
        <ul *ngIf="!leaderboardLoading && leaderboard.length > 0" class="lb-list">
          <li *ngFor="let item of leaderboard; index as i">
            <span class="rank">#{{ i + 1 }}</span>
            <div class="user">
              <span class="name">{{ item.citizenUsername || 'Citizen' }}</span>
              <span class="points">{{ item.totalPoints }} pts</span>
            </div>
          </li>
        </ul>
        <div *ngIf="!leaderboardLoading && leaderboard.length === 0" class="lb-empty">
          No contributors yet – be the first to report.
        </div>
      </aside>

      <aside class="transparency-card">
        <h2>Public Transparency</h2>
        <div *ngIf="transparencyLoading" class="lb-loading">Loading city stats...</div>
        <ng-container *ngIf="!transparencyLoading && transparency">
          <div class="transparency-grid">
            <div>
              <span class="label">Resolved</span>
              <strong>{{ transparency.resolvedCount }}</strong>
            </div>
            <div>
              <span class="label">Overdue</span>
              <strong class="warn">{{ transparency.overdueCount }}</strong>
            </div>
            <div>
              <span class="label">Avg. hours</span>
              <strong>{{ transparency.averageResolutionHours | number:'1.0-1' }}</strong>
            </div>
            <div>
              <span class="label">Rating</span>
              <strong>{{ transparency.averageCitizenRating | number:'1.1-1' }}/5</strong>
            </div>
          </div>
        </ng-container>
      </aside>

      <!-- Incident Details Panel (left side) -->
      <aside *ngIf="selectedIncident" class="incident-details-card">
        <button class="close-btn" (click)="selectedIncident = null">&times;</button>
        <h2>{{ selectedIncident.title }}</h2>
        <div class="incident-meta">
          <span class="status" [class]="'status-' + selectedIncident.status.toLowerCase()">{{ selectedIncident.status }}</span>
          <span class="category">{{ selectedIncident.category || 'Uncategorized' }}</span>
          <span class="date">{{ selectedIncident.createdAt | date:'short' }}</span>
        </div>
        <p class="description" *ngIf="selectedIncident.description">{{ selectedIncident.description }}</p>
        <div class="address" *ngIf="selectedIncident.address">
          <strong>Address:</strong> {{ selectedIncident.address }}
        </div>
        <div class="reporter">
          <strong>Reported by:</strong> {{ selectedIncident.reporterUsername }}
        </div>
        <div *ngIf="selectedIncident.photoPath" class="photo-container">
          <img [src]="getPhotoUrl(selectedIncident.photoPath)" [alt]="selectedIncident.title" class="incident-photo" />
        </div>
      </aside>

      <!-- Map fills the viewport -->
      <div class="map-shell" [class.with-panel]="selectedIncident">
        <div #mapEl id="landing-leaflet-map"></div>
      </div>
    </div>
  `,
  styles: [`
    .landing-shell {
      position:relative;
      height:calc(100vh - 60px);
      background:#0f0f1a;
      color:#fff;
      overflow:hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .map-shell {
      position:absolute;
      inset:0;
      z-index:0;
      transition: left 0.3s ease;
    }
    .map-shell.with-panel {
      left: 320px;
    }
    #landing-leaflet-map {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      z-index:0;
    }

    .hero {
      position:absolute;
      top:1.5rem;
      left:50%;
      transform:translateX(-50%);
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:.75rem;
      z-index:1000;
      text-align:center;
      pointer-events:none;
    }
    .hero-copy {
      padding:.85rem 1.4rem;
      border-radius:999px;
      background:rgba(10,10,20,.72);
      backdrop-filter:blur(18px);
      border:1px solid rgba(255,255,255,.14);
      box-shadow:0 18px 45px rgba(0,0,0,.65);
      pointer-events:auto;
    }
    .hero-copy h1 {
      margin:0;
      font-size:1.4rem;
      letter-spacing:.02em;
    }
    .hero-copy p {
      margin:.2rem 0 0;
      font-size:.85rem;
      color:#cfcfcf;
    }

    .hero-pill {
      margin-top:.5rem;
      display:flex;
      align-items:center;
      gap:1.25rem;
      padding:.55rem .95rem;
      border-radius:999px;
      background:rgba(10,10,20,.82);
      border:1px solid rgba(79,195,247,.45);
      box-shadow:0 14px 35px rgba(0,0,0,.7);
      pointer-events:auto;
    }
    .stat {
      display:flex;
      flex-direction:column;
      align-items:flex-start;
    }
    .label {
      font-size:.7rem;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#8ea0b5;
    }
    .value {
      font-size:1.05rem;
      font-weight:700;
    }
    .value.pending { color:#ffca28; }
    .value.resolved { color:#4fc3f7; }
    .divider {
      width:1px;
      height:1.9rem;
      background:linear-gradient(to bottom, transparent, rgba(255,255,255,.6), transparent);
    }

    .helper-card {
      position:absolute;
      left:1.5rem;
      bottom:1.5rem;
      max-width:320px;
      padding:1rem 1.1rem;
      border-radius:14px;
      background:radial-gradient(circle at 0 0, rgba(79,195,247,.32), rgba(10,10,20,.92));
      border:1px solid rgba(79,195,247,.55);
      box-shadow:0 20px 50px rgba(0,0,0,.75);
      font-size:.85rem;
      z-index:1000;
    }
    .helper-card h2 {
      margin:0 0 .4rem;
      font-size:.95rem;
    }
    .helper-card ul {
      margin:0;
      padding-left:1.1rem;
      color:#d0e2ff;
    }
    .helper-card li {
      margin:.15rem 0;
    }

    .leaderboard-card {
      position:absolute;
      right:1.5rem;
      top:5rem;
      width:260px;
      padding:1rem 1.1rem;
      border-radius:14px;
      background:radial-gradient(circle at 100% 0, rgba(255,213,79,.25), rgba(10,10,20,.95));
      border:1px solid rgba(255,213,79,.55);
      box-shadow:0 20px 50px rgba(0,0,0,.8);
      font-size:.85rem;
      z-index:1000;
    }
    .leaderboard-card h2 {
      margin:0 0 .25rem;
      font-size:.95rem;
    }
    .transparency-card {
      position:absolute;
      right:1.5rem;
      bottom:1.5rem;
      width:260px;
      padding:1rem 1.1rem;
      border-radius:14px;
      background:rgba(10,10,20,.92);
      border:1px solid rgba(129,199,132,.45);
      box-shadow:0 20px 50px rgba(0,0,0,.75);
      font-size:.85rem;
      z-index:1000;
    }
    .transparency-card h2 { margin:0 0 .7rem; font-size:.95rem; }
    .transparency-grid { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; }
    .transparency-grid div { display:flex; flex-direction:column; gap:.1rem; }
    .transparency-grid strong { color:#c8e6c9; font-size:1rem; }
    .transparency-grid .warn { color:#ffca28; }
    .leaderboard-card .subtitle {
      margin:0 0 .6rem;
      font-size:.75rem;
      color:#d1c4e9;
    }
    .lb-loading, .lb-empty {
      font-size:.8rem;
      color:#b0bec5;
    }
    .lb-list {
      list-style:none;
      margin:0;
      padding:0;
      display:flex;
      flex-direction:column;
      gap:.35rem;
    }
    .lb-list li {
      display:flex;
      align-items:center;
      gap:.55rem;
    }
    .rank {
      width:1.6rem;
      text-align:center;
      font-weight:700;
      color:#ffd54f;
    }
    .user {
      flex:1;
      display:flex;
      justify-content:space-between;
      align-items:baseline;
      gap:.35rem;
    }
    .name {
      font-weight:500;
      color:#eceff1;
    }
    .points {
      font-size:.78rem;
      color:#cfd8dc;
    }

    .incident-details-card {
      position:absolute;
      left:1.5rem;
      top:1.5rem;
      width:300px;
      max-height:calc(100vh - 120px);
      padding:1rem 1.1rem;
      border-radius:14px;
      background:radial-gradient(circle at 0 0, rgba(79,195,247,.32), rgba(10,10,20,.92));
      border:1px solid rgba(79,195,247,.55);
      box-shadow:0 20px 50px rgba(0,0,0,.75);
      font-size:.85rem;
      z-index:1000;
      overflow-y:auto;
    }
    .incident-details-card .close-btn {
      position:absolute;
      top:0.5rem;
      right:0.5rem;
      background:none;
      border:none;
      color:#fff;
      font-size:1.5rem;
      cursor:pointer;
      padding:0;
      width:1.5rem;
      height:1.5rem;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .incident-details-card h2 {
      margin:0 0 0.5rem 0;
      font-size:1.1rem;
      color:#4fc3f7;
    }
    .incident-meta {
      display:flex;
      flex-wrap:wrap;
      gap:0.5rem;
      margin-bottom:0.75rem;
    }
    .status {
      padding:0.2rem 0.5rem;
      border-radius:4px;
      font-size:0.75rem;
      font-weight:600;
      text-transform:uppercase;
    }
    .status-pending { background:#ffca28; color:#000; }
    .status-validated { background:#81c784; color:#000; }
    .status-resolved { background:#4fc3f7; color:#000; }
    .category {
      color:#ffd54f;
      font-weight:500;
    }
    .date {
      color:#b0bec5;
      font-size:0.8rem;
    }
    .description {
      margin:0 0 0.75rem 0;
      line-height:1.4;
      color:#e0e0e0;
    }
    .address, .reporter {
      margin:0 0 0.5rem 0;
      font-size:0.85rem;
      color:#cfcfcf;
    }
    .photo-container {
      margin-top:1rem;
    }
    .incident-photo {
      width:100%;
      height:auto;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.2);
    }

    @media (max-width: 768px) {
      .hero-copy {
        max-width: 90vw;
      }
      .hero-copy h1 {
        font-size:1.1rem;
      }
      .hero-copy p {
        font-size:.78rem;
      }
      .hero-pill {
        gap:.85rem;
        padding:.45rem .75rem;
      }
      .helper-card {
        left:50%;
        transform:translateX(-50%);
        bottom:.9rem;
        max-width:90vw;
      }
      .leaderboard-card {
        position:static;
        margin:0.5rem auto 0;
        width:90vw;
      }
      .transparency-card {
        display:none;
      }
      .incident-details-card {
        left:50%;
        transform:translateX(-50%);
        top:1rem;
        width:90vw;
        max-height:50vh;
      }
      .map-shell.with-panel {
        left: 0;
        top: 55vh;
      }
    }
  `]
})
export class PublicMapComponent implements AfterViewInit {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map!: LeafletMap;
  private markersLayer!: LayerGroup;

  totalIncidents = 0;

  leaderboard: CitizenPointsResponse[] = [];
  leaderboardLoading = true;
  transparency?: TransparencyStats;
  transparencyLoading = true;

  currentGovernorate = 'Tunisia';

  selectedIncident: IncidentResponse | null = null;
  allIncidents: IncidentResponse[] = [];
  filteredIncidents: IncidentResponse[] = [];

  get pendingCount(): number {
    return this.filteredIncidents.filter(i => i.status === 'PENDING').length;
  }

  get resolvedCount(): number {
    return this.filteredIncidents.filter(i => i.status === 'RESOLVED').length;
  }

  // Tunisian governorates with approximate boundaries
  private tunisianGovernorates = [
    { name: 'Tunis', lat: 36.8065, lng: 10.1815, bounds: [[36.7, 10.0], [37.0, 10.4]] },
    { name: 'Ariana', lat: 36.8625, lng: 10.1956, bounds: [[36.8, 10.1], [36.9, 10.3]] },
    { name: 'Ben Arous', lat: 36.7531, lng: 10.2189, bounds: [[36.6, 10.0], [36.8, 10.4]] },
    { name: 'Manouba', lat: 36.8080, lng: 10.0972, bounds: [[36.7, 9.9], [36.9, 10.2]] },
    { name: 'Nabeul', lat: 36.4513, lng: 10.7357, bounds: [[36.3, 10.4], [36.6, 10.9]] },
    { name: 'Zaghouan', lat: 36.4029, lng: 10.1429, bounds: [[36.2, 9.8], [36.6, 10.4]] },
    { name: 'Bizerte', lat: 37.2744, lng: 9.8739, bounds: [[37.0, 9.5], [37.4, 10.2]] },
    { name: 'Béja', lat: 36.7256, lng: 9.1817, bounds: [[36.4, 8.8], [36.9, 9.5]] },
    { name: 'Jendouba', lat: 36.5011, lng: 8.7803, bounds: [[36.2, 8.3], [36.7, 9.1]] },
    { name: 'Kef', lat: 36.1742, lng: 8.7142, bounds: [[35.8, 8.2], [36.5, 9.0]] },
    { name: 'Siliana', lat: 36.0843, lng: 9.3708, bounds: [[35.8, 9.0], [36.4, 9.7]] },
    { name: 'Kairouan', lat: 35.6781, lng: 10.0963, bounds: [[35.3, 9.5], [36.0, 10.5]] },
    { name: 'Kasserine', lat: 35.1676, lng: 8.8365, bounds: [[34.8, 8.2], [35.6, 9.2]] },
    { name: 'Sidi Bouzid', lat: 35.0381, lng: 9.4847, bounds: [[34.6, 9.0], [35.4, 9.9]] },
    { name: 'Sousse', lat: 35.8256, lng: 10.6367, bounds: [[35.6, 10.3], [36.1, 10.9]] },
    { name: 'Monastir', lat: 35.7833, lng: 10.8333, bounds: [[35.5, 10.6], [35.9, 11.0]] },
    { name: 'Mahdia', lat: 35.5047, lng: 11.0622, bounds: [[35.2, 10.7], [35.7, 11.3]] },
    { name: 'Sfax', lat: 34.7406, lng: 10.7603, bounds: [[34.4, 10.4], [35.1, 11.1]] },
    { name: 'Gabès', lat: 33.8815, lng: 10.0982, bounds: [[33.5, 9.5], [34.3, 10.5]] },
    { name: 'Medenine', lat: 33.3549, lng: 10.5055, bounds: [[32.8, 10.0], [33.8, 11.0]] },
    { name: 'Tataouine', lat: 32.9297, lng: 10.4518, bounds: [[30.8, 10.0], [33.2, 10.9]] },
    { name: 'Gafsa', lat: 34.4250, lng: 8.7842, bounds: [[34.0, 8.2], [34.8, 9.2]] },
    { name: 'Tozeur', lat: 33.9197, lng: 8.1339, bounds: [[33.5, 7.5], [34.3, 8.8]] },
    { name: 'Kebili', lat: 33.7050, lng: 8.9690, bounds: [[33.0, 8.5], [34.0, 9.5]] }
  ];

  get isLoggedIn$(): Observable<boolean> {
    return this.authService.loginState$;
  }

  constructor(
    private http: HttpClient,
    private gamificationService: GamificationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private transparencyService: TransparencyService
  ) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadData();

    // Initial governorate detection after map is ready
    setTimeout(() => this.updateGovernorateData(), 1000);
  }

  private initMap(): void {
    this.map = createMap(this.mapEl.nativeElement, {
      center: [36.8065, 10.1815], // Tunis
      zoom: 12,
      zoomControl: true,
    });

    tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap & CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(this.map);

    this.markersLayer = layerGroup().addTo(this.map);

    // Add event listeners for map movement and zoom
    this.map.on('moveend', () => {
      console.log('Map moved');
      this.updateGovernorateData();
    });
    this.map.on('zoomend', () => {
      console.log('Map zoomed');
      this.updateGovernorateData();
    });
  }

  private loadData(): void {
    const params = new HttpParams()
      .set('page', 0)
      .set('size', 1000) // Load more incidents for filtering
      .set('sort', 'createdAt,desc');

    this.http.get<PageResponse<IncidentResponse>>(
      `${environment.apiBaseUrl}/api/public/incidents`,
      { params }
    ).subscribe(page => {
      this.allIncidents = page.content;
      this.totalIncidents = page.totalElements;

      // Update governorate data based on current map view
      this.updateGovernorateData();
    });

    this.gamificationService.getPublicLeaderboard().subscribe({
      next: data => {
        this.leaderboard = data;
        this.leaderboardLoading = false;
      },
      error: () => {
        this.leaderboard = [];
        this.leaderboardLoading = false;
      }
    });

    this.transparencyService.getStats().subscribe({
      next: stats => {
        this.transparency = stats;
        this.transparencyLoading = false;
      },
      error: () => {
        this.transparencyLoading = false;
      }
    });
  }

  private updateGovernorateData(): void {
    if (!this.map) {
      console.log('Map not ready');
      return;
    }

    if (this.allIncidents.length === 0) {
      console.log('No incidents loaded yet');
      return;
    }

    const bounds = this.map.getBounds();
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    console.log(`Map bounds: ${bounds.getSouthWest().lat}, ${bounds.getSouthWest().lng} to ${bounds.getNorthEast().lat}, ${bounds.getNorthEast().lng}`);
    console.log(`Map center: ${center.lat}, ${center.lng}, zoom: ${zoom}`);

    // Filter incidents within current map bounds
    this.filteredIncidents = this.allIncidents.filter(incident => {
      return bounds.contains([incident.latitude, incident.longitude]);
    });

    console.log(`Filtered ${this.filteredIncidents.length} incidents within map bounds`);

    // Update marker rendering
    this.renderMarkers(this.filteredIncidents);

    // Update governorate name based on zoom level
    this.updateGovernorateName(zoom);

    // Trigger change detection
    this.cdr.detectChanges();
  }

  private updateGovernorateName(zoom: number): void {
    if (zoom < 9) {
      this.currentGovernorate = 'Tunisia';
    } else if (zoom < 11) {
      this.currentGovernorate = 'Tunis Region';
    } else {
      // Try to detect specific governorate
      const center = this.map?.getCenter();
      if (center) {
        const governorate = this.detectGovernorate(center.lat, center.lng);
        this.currentGovernorate = governorate;
      }
    }
  }

  private detectGovernorate(lat: number, lng: number): string {
    console.log(`Detecting governorate for coordinates: ${lat}, ${lng}`);

    // Find the governorate that contains the current coordinates
    for (const gov of this.tunisianGovernorates) {
      const [[minLat, minLng], [maxLat, maxLng]] = gov.bounds;
      console.log(`Checking ${gov.name}: bounds [${minLat}, ${minLng}] to [${maxLat}, ${maxLng}]`);
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        console.log(`Found governorate: ${gov.name}`);
        return gov.name;
      }
    }

    console.log('No governorate found, using fallback');
    // If no specific governorate, check zoom level
    const zoom = this.map?.getZoom() || 8;
    if (zoom < 9) {
      return 'Tunisia'; // Country level
    } else if (zoom < 11) {
      return 'Tunis Region'; // Regional level
    } else {
      return 'Tunis'; // Default to capital
    }
  }

  private isIncidentInGovernorate(incident: IncidentResponse, governorate: string): boolean {
    if (governorate === 'Tunisia') return true; // Show all incidents

    const gov = this.tunisianGovernorates.find(g => g.name === governorate);
    if (!gov) return true;

    const [[minLat, minLng], [maxLat, maxLng]] = gov.bounds;
    return incident.latitude >= minLat && incident.latitude <= maxLat &&
           incident.longitude >= minLng && incident.longitude <= maxLng;
  }

  private renderMarkers(incidents: IncidentResponse[]): void {
    this.markersLayer.clearLayers();

    incidents.forEach(inc => {
      const color = inc.status === 'PENDING'
        ? '#ffca28'
        : inc.status === 'RESOLVED'
          ? '#4fc3f7'
          : '#81c784';

      const emoji = this.categoryIcon(inc.category);
      const icon = divIcon({
        html: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:22px;height:22px;border-radius:50%;
          background:rgba(15,15,26,.92);border:2px solid ${color};
          box-shadow:0 0 8px ${color}88;
          font-size:12px;
        ">${emoji}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const m = marker([inc.latitude, inc.longitude], { icon });
      m.bindTooltip(`${inc.title}`, { direction: 'top' });
      m.on('click', () => {
        this.selectedIncident = inc;
        this.cdr.detectChanges();
      });
      this.markersLayer.addLayer(m);
    });
  }

  private categoryIcon(category?: string): string {
    switch (category) {
      case 'POTHOLE':           return '🕳️';
      case 'WATER_LEAK':        return '💧';
      case 'BROKEN_STREETLIGHT':return '💡';
      case 'GRAFFITI':          return '🎨';
      case 'ILLEGAL_DUMPING':   return '🗑️';
      case 'DAMAGED_SIGN':      return '🚧';
      case 'FLOODING':          return '🌊';
      default:                  return '❗';
    }
  }

  getPhotoUrl(photoPath: string): string {
    if (photoPath.startsWith('http')) {
      return photoPath;
    }
    // Extract filename from path like "uploads/incidents/uuid_filename.jpg"
    const filename = photoPath.split('/').pop();
    return `${environment.apiBaseUrl}/api/uploads/incidents/${filename}`;
  }
}

