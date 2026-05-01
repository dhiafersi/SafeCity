import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="unauth-page">
      <div class="unauth-card">
        <div class="icon">🔒</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to view this page.<br>
           Please contact an administrator or use a different account.</p>
        <div class="actions">
          <button class="btn-back" (click)="goHome()">← Go Home</button>
          <button class="btn-logout" (click)="auth.logout()">Logout</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .unauth-page {
      display:flex; align-items:center; justify-content:center;
      min-height:100vh; background:radial-gradient(ellipse at 50% 40%, #3a0a0a 0%, #0f0f1a 70%);
    }
    .unauth-card {
      text-align:center; padding:3rem 2.5rem;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,100,100,.15);
      border-radius:20px; max-width:420px; color:#fff;
      box-shadow:0 20px 60px rgba(0,0,0,.5);
    }
    .icon { font-size:4rem; margin-bottom:1rem; }
    h1   { margin:0 0 .75rem; font-size:1.6rem; color:#ef9a9a; }
    p    { color:#aaa; line-height:1.6; margin:0 0 2rem; }
    .actions { display:flex; gap:1rem; justify-content:center; }
    .btn-back {
      padding:.55rem 1.3rem; border-radius:8px; border:1px solid rgba(255,255,255,.15);
      background:rgba(255,255,255,.06); color:#fff; cursor:pointer; transition:.2s; font-size:.9rem;
    }
    .btn-back:hover { background:rgba(255,255,255,.12); }
    .btn-logout {
      padding:.55rem 1.3rem; border-radius:8px; border:none;
      background:rgba(239,83,80,.2); color:#ef9a9a; cursor:pointer; transition:.2s; font-size:.9rem;
    }
    .btn-logout:hover { background:rgba(239,83,80,.35); }
  `]
})
export class UnauthorizedComponent {
  constructor(public auth: AuthService, private router: Router) {}

  goHome(): void {
    if (this.auth.isLoggedIn()) {
      this.auth.hasRole('ADMIN')
        ? this.router.navigate(['/admin/dashboard'])
        : this.router.navigate(['/citizen/report']);
    } else {
      this.auth.login();
    }
  }
}
