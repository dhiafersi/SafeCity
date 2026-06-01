import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IncidentService, IncidentResponse, PageResponse } from '../../../core/services/incident.service';
import { GamificationService, HeatmapPoint } from '../../../core/services/gamification.service';
import { 
  Map as LeafletMap, 
  LayerGroup 
} from 'leaflet';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-page">
      <!-- Header -->
      <div class="dash-header">
        <div>
          <h1>🗺️ Incident Map Dashboard</h1>
          <p>Real-time urban incidents with predictive heatmap overlay</p>
        </div>
        <div class="dash-controls">
          <a routerLink="/admin/incidents" class="btn-manage">
            📋 Manage Reports
          </a>
          <button class="btn-toggle" [class.active]="heatmapVisible" (click)="toggleHeatmap()">
            🔥 {{ heatmapVisible ? 'Hide' : 'Show' }} Heatmap
          </button>
          <button class="btn-refresh" (click)="loadData()">🔄 Refresh</button>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-val">{{ totalIncidents }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat pending">
          <span class="stat-val">{{ pendingCount }}</span>
          <span class="stat-label">Pending</span>
        </div>
        <div class="stat validated">
          <span class="stat-val">{{ validatedCount }}</span>
          <span class="stat-label">Validated</span>
        </div>
        <div class="stat resolved">
          <span class="stat-val">{{ resolvedCount }}</span>
          <span class="stat-label">Resolved</span>
        </div>
      </div>

      <!-- Map -->
      <div class="map-wrapper" [class.heatmap-active]="heatmapVisible">
        <div #mapEl id="leaflet-map"></div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item"><span class="dot yellow"></span> Pending</span>
        <span class="legend-item"><span class="dot green"></span> Validated</span>
        <span class="legend-item"><span class="dot blue"></span> Resolved</span>
        <span class="legend-item heat-legend">🔥 Heatmap = incident density</span>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display:flex; flex-direction:column; height:calc(100vh - 60px);
      background:#0f0f1a; color:#fff; overflow:hidden;
    }
    .dash-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:.75rem 1.5rem; background:rgba(255,255,255,.03);
      border-bottom:1px solid rgba(255,255,255,.07); flex-shrink:0;
    }
    .dash-header h1 { margin:0 0 .15rem; font-size:1.2rem; }
    .dash-header p  { margin:0; font-size:.8rem; color:#888; }
    .dash-controls  { display:flex; gap:.5rem; }
    .btn-manage {
      padding:.45rem 1rem; border-radius:999px;
      border:1px solid rgba(129,199,132,.4);
      background:rgba(56,142,60,.15); color:#c8e6c9;
      font-size:.82rem; font-weight:600; text-decoration:none;
      cursor:pointer; transition:.2s;
    }
    .btn-manage:hover {
      background:rgba(56,142,60,.25);
    }

    .btn-toggle, .btn-refresh {
      padding:.4rem 1rem; border:none; border-radius:8px;
      font-size:.82rem; cursor:pointer; transition:.2s; font-weight:600;
    }
    .btn-toggle { background:rgba(255,107,53,.12); color:#ff7043; border:1px solid rgba(255,107,53,.3); }
    .btn-toggle.active { background:rgba(255,107,53,.25); }
    .btn-toggle:hover { background:rgba(255,107,53,.2); }
    .btn-refresh { background:rgba(79,195,247,.1); color:#4fc3f7; border:1px solid rgba(79,195,247,.3); }
    .btn-refresh:hover { background:rgba(79,195,247,.2); }

    .stats-bar {
      display:flex; gap:.5rem; padding:.6rem 1.5rem;
      background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.06);
      flex-shrink:0; flex-wrap:wrap;
    }
    .stat {
      display:flex; flex-direction:column; align-items:center;
      padding:.4rem .9rem; border-radius:8px; background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08); min-width:70px;
    }
    .stat-val   { font-size:1.3rem; font-weight:700; line-height:1.2; }
    .stat-label { font-size:.65rem; color:#888; text-transform:uppercase; letter-spacing:.5px; }
    .stat.pending   .stat-val { color:#ffca28; }
    .stat.validated .stat-val { color:#81c784; }
    .stat.resolved  .stat-val { color:#4fc3f7; }

    .map-wrapper { flex:1; position:relative; }
    #leaflet-map  { width:100%; height:100%; }
    .map-wrapper ::ng-deep .leaflet-heatmap-layer {
      z-index:450 !important;
      opacity:.78;
      pointer-events:none;
    }
    .map-wrapper.heatmap-active ::ng-deep .leaflet-marker-icon {
      opacity:.42 !important;
      filter:saturate(.7);
    }

    .legend {
      display:flex; gap:1.5rem; padding:.5rem 1.5rem; flex-shrink:0;
      background:rgba(255,255,255,.02); border-top:1px solid rgba(255,255,255,.06);
      font-size:.8rem; color:#aaa; flex-wrap:wrap;
    }
    .legend-item  { display:flex; align-items:center; gap:.4rem; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .dot.yellow { background:#ffca28; }
    .dot.green  { background:#81c784; }
    .dot.blue   { background:#4fc3f7; }
    .heat-legend { color:#ff7043; }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map!: LeafletMap;
  private markersLayer!: LayerGroup;
  private heatLayer: any;

  incidents: IncidentResponse[] = [];
  heatmapPoints: HeatmapPoint[] = [];

  heatmapVisible = false;
  totalIncidents  = 0;
  pendingCount    = 0;
  validatedCount  = 0;
  resolvedCount   = 0;

  constructor(
    private incidentService: IncidentService,
    private gamificationService: GamificationService
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    const L = (window as any).L;
    this.map = L.map(this.mapEl.nativeElement, {
      center: [36.8065, 10.1815], // Default: Tunis, Tunisia
      zoom: 12,
      zoomControl: true,
    });

    // Dark tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  loadData(): void {
    // Load all incidents
    this.incidentService.getAll(0, 200).subscribe((page: PageResponse<IncidentResponse>) => {
      this.incidents     = page.content;
      this.totalIncidents = page.totalElements;
      this.pendingCount   = this.incidents.filter(i => i.status === 'PENDING').length;
      this.validatedCount = this.incidents.filter(i => i.status === 'VALIDATED').length;
      this.resolvedCount  = this.incidents.filter(i => i.status === 'RESOLVED').length;
      this.renderMarkers();
      this.renderHeatmap();
    });

    // Load heatmap data
    this.gamificationService.getHeatmapData().subscribe((data: HeatmapPoint[]) => {
      this.heatmapPoints = data;
      this.renderHeatmap();
    });
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();
    const L = (window as any).L;

    this.incidents.forEach(inc => {
      const color = this.statusColor(inc.status);
      const emoji = this.categoryIcon(inc.category);
      const icon = L.divIcon({
        html: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:22px;height:22px;border-radius:50%;
          background:${this.statusBg(inc.status)};border:2px solid #fff;
          box-shadow:0 0 8px ${color}88;
          font-size:12px;
        ">${emoji}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const m = L.marker([inc.latitude, inc.longitude], { icon });
      m.bindPopup(this.buildPopup(inc), { maxWidth: 260 });
      this.markersLayer.addLayer(m);
    });
  }

  private buildPopup(inc: IncidentResponse): string {
    return `
      <div style="font-family:'Inter',sans-serif;padding:.25rem;">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:.3rem;">${inc.title}</div>
        <div style="font-size:.75rem;color:#888;margin-bottom:.4rem;">
          ${inc.category ?? 'Uncategorized'} &bull; ${new Date(inc.createdAt).toLocaleDateString()}
        </div>
        <div style="margin-bottom:.4rem;">
          <span style="
            font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:20px;text-transform:uppercase;
            background:${this.statusBg(inc.status)};color:${this.statusColor(inc.status)};
          ">${inc.status}</span>
        </div>
        ${inc.description ? `<p style="margin:0;font-size:.8rem;color:#555;">${inc.description}</p>` : ''}
        ${inc.aiCategory ? `<div style="color:#7b1fa2;font-size:.75rem;margin-top:.3rem;">🤖 AI: ${inc.aiCategory} (${((inc.aiConfidence ?? 0) * 100).toFixed(1)}%)</div>` : ''}
        <div style="font-size:.72rem;color:#999;margin-top:.3rem;">
          📍 ${inc.latitude.toFixed(6)}, ${inc.longitude.toFixed(6)}
        </div>
      </div>
    `;
  }

  private renderHeatmap(): void {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    const points = this.normalizedHeatmapPoints();
    if (points.length === 0) return;

    // Build heatmap data: [lat, lng, intensity]
    const maxCount = Math.max(...points.map(p => p.count), 1);
    const data = points.map(p => {
      const normalizedCount = p.count / maxCount;
      const intensity = Math.min(0.88, Math.max(0.42, Math.sqrt(normalizedCount) * 0.82));
      return [p.lat, p.lng, intensity];
    });

    // Access Leaflet Heat through the global window object
    const L = (window as any).L;
    if (L && L.heatLayer) {
      this.heatLayer = L.heatLayer(data, {
        radius: 88,
        blur: 44,
        max: 1,
        minOpacity: 0.58,
        maxZoom: 15,
        gradient: {
          0.15: '#00bcd4',
          0.35: '#00c853',
          0.55: '#ffee58',
          0.75: '#ff8f00',
          1.00: '#e53935',
        },
      });

      if (this.heatmapVisible && this.heatLayer) {
        this.focusHeatmapIfOffscreen();
        this.heatLayer.addTo(this.map);
        this.heatLayer.redraw?.();
        this.bringHeatmapForward();
      }
    } else {
      console.warn('Leaflet Heat library not available');
    }
  }

  private normalizedHeatmapPoints(): HeatmapPoint[] {
    const apiPoints = this.heatmapPoints
      .map(p => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
        count: Math.max(1, Number(p.count) || 1),
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (apiPoints.length > 0) return this.aggregateCityCenterPoints(apiPoints);

    const incidentPoints = this.incidents
      .map(inc => ({
        lat: Number(inc.latitude),
        lng: Number(inc.longitude),
        count: 1,
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    return this.aggregateCityCenterPoints(incidentPoints);
  }

  private aggregateCityCenterPoints(points: HeatmapPoint[]): HeatmapPoint[] {
    const grouped = new Map<string, { latSum: number; lngSum: number; count: number }>();
    points.forEach(point => {
      // 3 decimals is roughly a city-block scale, better for compact areas like Bizerte center.
      const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.latSum += point.lat * point.count;
        existing.lngSum += point.lng * point.count;
        existing.count += point.count;
      } else {
        grouped.set(key, {
          latSum: point.lat * point.count,
          lngSum: point.lng * point.count,
          count: point.count,
        });
      }
    });

    return Array.from(grouped.values())
      .map(point => ({
        lat: point.latSum / point.count,
        lng: point.lngSum / point.count,
        count: point.count,
      }));
  }

  private bringHeatmapForward(): void {
    const canvas = this.mapEl.nativeElement.querySelector<HTMLCanvasElement>('.leaflet-heatmap-layer');
    if (canvas) {
      canvas.style.zIndex = '450';
      canvas.style.pointerEvents = 'none';
    }
  }

  private focusHeatmapIfOffscreen(): void {
    const points = this.normalizedHeatmapPoints();
    if (points.length === 0) return;

    const visibleBounds = this.map.getBounds().pad(0.15);
    const hasVisibleHeat = points.some(p => visibleBounds.contains([p.lat, p.lng]));
    if (hasVisibleHeat) return;

    const L = (window as any).L;
    const latLngs: [number, number][] = points.map(p => [p.lat, p.lng]);
    if (latLngs.length === 1) {
      this.map.setView(latLngs[0], Math.max(this.map.getZoom(), 14));
    } else {
      this.map.fitBounds(L.latLngBounds(latLngs), {
        padding: [48, 48],
        maxZoom: 14,
      });
    }
  }

  toggleHeatmap(): void {
    this.heatmapVisible = !this.heatmapVisible;
    if (!this.heatLayer) {
      if (this.heatmapVisible) {
        // If toggling on but no layer exists, try to render it
        this.renderHeatmap();
      }
      return;
    }

    if (this.heatmapVisible) {
      this.focusHeatmapIfOffscreen();
      this.heatLayer.addTo(this.map);
      this.heatLayer.redraw?.();
      this.bringHeatmapForward();
    } else {
      this.map.removeLayer(this.heatLayer);
    }
  }

  private statusColor(status: string): string {
    return { PENDING: '#ffca28', VALIDATED: '#81c784', RESOLVED: '#4fc3f7' }[status] ?? '#888';
  }

  private statusBg(status: string): string {
    return { PENDING: 'rgba(255,193,7,.15)', VALIDATED: 'rgba(129,199,132,.15)', RESOLVED: 'rgba(79,195,247,.15)' }[status] ?? '#333';
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
