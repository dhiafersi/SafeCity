import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalyticsService, AnalyticsResponse, CategoryStat, ResolutionTrendStat } from '../../../core/services/analytics.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="analytics-container">
      <header class="page-header">
        <div>
          <h1>📊 City Analytics Dashboard</h1>
          <p>Bizerte Smart City Insights & Resource Optimization</p>
        </div>
        <div class="header-actions">
          <a routerLink="/admin/dashboard" class="btn-secondary">🗺️ Map View</a>
          <button (click)="refresh()" class="btn-primary">🔄 refresh Data</button>
        </div>
      </header>

      <div class="stats-grid">
        <div class="stat-card highlight">
          <span class="stat-label">Avg. Resolution Time</span>
          <span class="stat-value">{{ analyticsData?.averageResolutionTime | number:'1.1-1' }} <small>hrs</small></span>
          <span class="stat-desc">Time from report to "Resolved" status</span>
        </div>
        <!-- More summary stats could go here -->
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>Category Distribution</h3>
          <p class="chart-subtitle">Incident volume by type</p>
          <div class="canvas-wrapper">
            <canvas #categoryChart></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3>Resolution Performance</h3>
          <p class="chart-subtitle">Trend of average fix time (hours)</p>
          <div class="canvas-wrapper">
            <canvas #trendChart></canvas>
          </div>
        </div>
      </div>

      <div class="full-width-card">
        <h3>📍 Top Active Neighborhoods</h3>
        <p class="chart-subtitle">Most reported areas in Bizerte</p>
        <div class="neighborhood-list">
          <div *ngFor="let n of analyticsData?.neighborhoodStats" class="neighborhood-item">
            <span class="n-name">{{ n.name }}</span>
            <div class="n-bar-wrapper">
              <div class="n-bar" [style.width]="(n.count / (analyticsData?.neighborhoodStats?.[0]?.count || 1) * 100) + '%'"></div>
            </div>
            <span class="n-count">{{ n.count }} reports</span>
          </div>
        </div>
      </div>

      <div class="full-width-card" style="margin-top: 1.5rem;">
        <h3>💡 Smart City Tip</h3>
        <p>Bizerte's infrastructure is showing signs of stress in <strong>Water Leak</strong> categories. Early maintenance in identified hot neighborhoods can save 30% on repair costs.</p>
      </div>
    </div>
  `,
  styles: [`
    .analytics-container {
      padding: 1.5rem;
      background: #0f0f1a;
      min-height: calc(100vh - 60px);
      color: #fff;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .page-header h1 { margin: 0; font-size: 1.8rem; }
    .page-header p { margin: 0.25rem 0 0; color: #888; }
    
    .header-actions { display: flex; gap: 0.75rem; }
    .btn-primary, .btn-secondary {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .btn-primary { background: #4fc3f7; color: #000; }
    .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
    .btn-primary:hover { background: #81d4fa; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 1.5rem;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
    }
    .stat-card.highlight {
      border-left: 4px solid #4fc3f7;
      background: linear-gradient(to right, rgba(79,195,247,0.05), transparent);
    }
    .stat-label { font-size: 0.9rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 2.2rem; font-weight: 800; margin: 0.5rem 0; }
    .stat-value small { font-size: 1rem; color: #666; font-weight: 400; }
    .stat-desc { font-size: 0.8rem; color: #666; }

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 992px) {
      .charts-grid { grid-template-columns: 1fr; }
    }

    .chart-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 1.5rem;
      border-radius: 12px;
    }
    .chart-card h3 { margin: 0; font-size: 1.1rem; }
    .chart-subtitle { margin: 0.2rem 0 1rem; font-size: 0.85rem; color: #777; }
    
    .canvas-wrapper {
      position: relative;
      height: 300px;
      width: 100%;
    }

    .full-width-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 1.5rem;
      border-radius: 12px;
    }
    .neighborhood-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }
    .neighborhood-item {
      display: grid;
      grid-template-columns: 140px 1fr 100px;
      align-items: center;
      gap: 1rem;
    }
    .n-name { font-weight: 500; font-size: 0.9rem; }
    .n-bar-wrapper { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
    .n-bar { height: 100%; background: #4fc3f7; border-radius: 4px; }
    .n-count { font-size: 0.8rem; color: #888; text-align: right; }

    .neighborhood-tip {
      margin-top: 1rem;
      background: rgba(79,195,247,0.1);
      border: 1px solid rgba(79,195,247,0.2);
      padding: 1rem;
      border-radius: 8px;
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .neighborhood-tip .icon { font-size: 1.5rem; }
  `]
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('categoryChart') categoryCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendCanvas!: ElementRef<HTMLCanvasElement>;

  analyticsData?: AnalyticsResponse;
  
  private categoryChartInstance?: Chart;
  private trendChartInstance?: Chart;

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngAfterViewInit(): void {
    // We'll initialize charts after data loads to have proper scales
  }

  refresh(): void {
    this.analyticsService.getAnalytics().subscribe(data => {
      this.analyticsData = data;
      this.initCharts();
    });
  }

  private initCharts(): void {
    if (!this.analyticsData) return;

    // Destroy existing instances if any
    this.categoryChartInstance?.destroy();
    this.trendChartInstance?.destroy();

    this.initCategoryChart(this.analyticsData.categorySplit);
    this.initTrendChart(this.analyticsData.resolutionTrend);
  }

  private initCategoryChart(stats: CategoryStat[]): void {
    const labels = stats.map(s => s.category);
    const data = stats.map(s => s.count);

    this.categoryChartInstance = new Chart(this.categoryCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#4fc3f7', '#ffca28', '#81c784', '#f06292', '#ba68c8', '#4db6ac', '#a1887f'
          ],
          borderWidth: 0,
          hoverOffset: 15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#aaa', padding: 20, font: { size: 11 } }
          }
        }
      }
    });
  }

  private initTrendChart(stats: ResolutionTrendStat[]): void {
    const labels = stats.map(s => s.date);
    const data = stats.map(s => s.averageHours);

    this.trendChartInstance = new Chart(this.trendCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Avg. Hours to Resolve',
          data: data,
          borderColor: '#4fc3f7',
          backgroundColor: 'rgba(79,195,247,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4fc3f7',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#666' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#666' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}
