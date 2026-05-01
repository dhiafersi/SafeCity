import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-public-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-shell">
      <!-- Hero overlay content -->
      <header class="hero">
        <div class="hero-copy">
          <h1>See your city in real time.</h1>
          <p>Explore live incident reports and urban issues directly on the map — no login required.</p>
        </div>
        <div class="hero-pill">
          <div class="stat">
            <span class="label">Live incidents</span>
            <span class="value">{{ totalIncidents }}</span>
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
        <h2>Top Contributors – Bizerte</h2>
        <p class="subtitle">Based on validated incident reports.</p>
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

      <!-- Map fills the viewport -->
      <div class="map-shell">
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
    }
  `]
})
export class PublicMapComponent implements AfterViewInit {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map!: LeafletMap;
  private markersLayer!: LayerGroup;

  totalIncidents = 0;
  pendingCount = 0;
  resolvedCount = 0;

  leaderboard: CitizenPointsResponse[] = [];
  leaderboardLoading = true;

  constructor(private http: HttpClient, private gamificationService: GamificationService) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadData();
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
  }

  private loadData(): void {
    const params = new HttpParams()
      .set('page', 0)
      .set('size', 200)
      .set('sort', 'createdAt,desc');

    this.http.get<PageResponse<IncidentResponse>>(
      `${environment.apiBaseUrl}/api/public/incidents`,
      { params }
    ).subscribe(page => {
      this.totalIncidents = page.totalElements;

      const pending = page.content.filter(i => i.status === 'PENDING');
      const resolved = page.content.filter(i => i.status === 'RESOLVED');

      this.pendingCount = pending.length;
      this.resolvedCount = resolved.length;

      this.renderMarkers(page.content);
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
}

