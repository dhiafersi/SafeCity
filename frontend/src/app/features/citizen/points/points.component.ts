import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-points',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="points-page">
      <div class="points-card">
        <div class="card-top">
          <div class="star-icon">⭐</div>
          <h1>My Impact Points</h1>
          <p>Earn points by reporting incidents that get validated by admins</p>
        </div>
        <div class="points-display" *ngIf="points !== null">
          <span class="points-value">{{ points }}</span>
          <span class="points-label">Impact Points</span>
        </div>
        <div class="loading" *ngIf="points === null">Loading...</div>
        <div class="info-box">
          <h3>How to earn points?</h3>
          <ul>
            <li>✅ Report a valid incident → +10 points when validated</li>
            <li>🌟 More contributions = higher community ranking</li>
            <li>🏆 Top contributors help shape city priorities</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .points-page {
      min-height:calc(100vh - 60px); display:flex; align-items:center;
      justify-content:center; padding:2rem 1rem;
      background:radial-gradient(ellipse at 70% 30%, #1a2a1a 0%, #0f0f1a 70%);
    }
    .points-card {
      width:100%; max-width:440px; text-align:center;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
      border-radius:20px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.5);
    }
    .card-top {
      padding:2.5rem 2rem 1.5rem;
      background:linear-gradient(135deg,#1b5e20,#2e7d32);
      color:#fff;
    }
    .star-icon { font-size:3rem; margin-bottom:.5rem; }
    .card-top h1 { margin:0 0 .5rem; font-size:1.5rem; }
    .card-top p { margin:0; opacity:.8; font-size:.9rem; }

    .points-display {
      padding:2rem; display:flex; flex-direction:column; align-items:center;
    }
    .points-value {
      font-size:4rem; font-weight:700;
      background:linear-gradient(135deg,#aed581,#ffcc02);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }
    .points-label { color:#aaa; font-size:.9rem; margin-top:.25rem; }

    .loading { padding:2rem; color:#888; }

    .info-box { padding:1.5rem 2rem 2rem; text-align:left; }
    .info-box h3 { color:#aed581; margin:0 0 .75rem; font-size:.95rem; }
    .info-box ul { margin:0; padding-left:0; list-style:none; }
    .info-box li { color:#ccc; font-size:.85rem; padding:.3rem 0; }
  `]
})
export class PointsComponent implements OnInit {
  points: number | null = null;

  constructor(private gamificationService: GamificationService) {}

  ngOnInit(): void {
    this.gamificationService.getMyPoints().subscribe({
      next: res => this.points = res.totalPoints,
      error: () => this.points = 0
    });
  }
}
