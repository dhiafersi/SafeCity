import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <nav class="navbar">
      <div class="navbar-brand" routerLink="/">
        <span class="brand-icon">🏙️</span>
        <span class="brand-text">SafeCity<strong>Connect</strong></span>
      </div>

      <ul class="navbar-links">
        <li>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            🗺️ Explore Map
          </a>
        </li>

        <ng-container *ngIf="auth.isLoggedIn()">
          <li *ngIf="auth.hasRole('CITIZEN')">
            <a routerLink="/citizen/report" routerLinkActive="active">📝 Report</a>
          </li>
          <li *ngIf="auth.hasRole('CITIZEN')">
            <a routerLink="/citizen/my-reports" routerLinkActive="active">📋 My Reports</a>
          </li>
          <li *ngIf="auth.hasRole('CITIZEN')">
            <a routerLink="/citizen/points" routerLinkActive="active">⭐ Points</a>
          </li>
          <li *ngIf="auth.hasRole('ADMIN')">
            <a routerLink="/admin/dashboard" routerLinkActive="active">🗺️ Map Dashboard</a>
          </li>
          <li *ngIf="auth.hasRole('ADMIN')">
            <a routerLink="/admin/analytics" routerLinkActive="active">📊 Analytics</a>
          </li>
          <li *ngIf="auth.hasRole('ADMIN')">
            <a routerLink="/admin/incidents" routerLinkActive="active">📋 Incidents</a>
          </li>
        </ng-container>
      </ul>

      <div class="navbar-user">
        <ng-container *ngIf="auth.isLoggedIn(); else loginBlock">
          <span class="username">👤 {{ auth.getUsername() }}</span>
          <span class="role-badge" [class.admin]="auth.hasRole('ADMIN')">
            {{ auth.hasRole('ADMIN') ? 'Admin' : 'Citizen' }}
          </span>
          <button class="btn-logout" (click)="auth.logout()">Logout</button>
        </ng-container>
        <ng-template #loginBlock>
          <button class="btn-login" (click)="auth.login()">Sign in</button>
        </ng-template>
      </div>
    </nav>

    <main class="main-content">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }

    .navbar {
      display: flex; align-items: center; gap: 1rem;
      padding: 0 1.5rem; height: 60px;
      background: linear-gradient(135deg, #0b1020 0%, #151b3a 100%);
      box-shadow: 0 2px 20px rgba(0,0,0,.45);
      position: sticky; top: 0; z-index: 1000;
    }
    .navbar-brand {
      display:flex; align-items:center; gap:.5rem; color:#fff; font-size:1.1rem;
      cursor:pointer; text-decoration:none;
    }
    .brand-icon { font-size:1.5rem; }
    .brand-text strong { color:#4fc3f7; }

    .navbar-links {
      display:flex; list-style:none; gap:.35rem; margin:0; padding:0;
      flex:1; justify-content:center;
    }
    .navbar-links a {
      padding:.42rem .95rem; border-radius:999px; color:rgba(255,255,255,.78);
      text-decoration:none; font-size:.88rem; transition:all .18s ease-out;
      white-space:nowrap;
    }
    .navbar-links a:hover, .navbar-links a.active {
      background:rgba(79,195,247,.18); color:#e3f6ff;
      box-shadow:0 0 0 1px rgba(79,195,247,.45);
    }

    .navbar-user { display:flex; align-items:center; gap:.75rem; margin-left:auto; }
    .username { color:#c0c7d4; font-size:.85rem; }
    .role-badge {
      font-size:.7rem; font-weight:600; padding:.2rem .6rem;
      border-radius:20px; background:#234125; color:#c5e1a5; text-transform:uppercase;
      letter-spacing:.06em;
    }
    .role-badge.admin { background:#111c4e; color:#90caf9; }

    .btn-login, .btn-logout {
      padding:.42rem 1.05rem; border:none; border-radius:999px;
      font-size:.85rem; cursor:pointer; transition:.18s ease-out;
    }
    .btn-login {
      background:#4fc3f7; color:#000; font-weight:600;
      box-shadow:0 0 0 1px rgba(0,0,0,.35);
    }
    .btn-login:hover { background:#81d4fa; transform:translateY(-1px); }
    .btn-logout {
      background:rgba(8,19,48,.8); color:#e3e8ff;
      border:1px solid rgba(255,255,255,.16);
    }
    .btn-logout:hover { background:rgba(16,27,60,1); }

    .main-content { flex:1; background:#0f0f1a; }
  `]
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}

