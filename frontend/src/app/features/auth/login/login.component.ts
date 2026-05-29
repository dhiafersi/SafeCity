import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="map-glow"></div>
      <section class="login-panel">
        <a routerLink="/" class="brand">
          <span class="brand-icon">+</span>
          <span>SafeCity<strong>Connect</strong></span>
        </a>

        <div class="copy">
          <p class="eyebrow">City operations portal</p>
          <h1>Welcome back</h1>
          <p>Track incident reports, chat with support, and keep every resolution accountable.</p>
        </div>

        <button type="button" class="google-btn" (click)="continueWithGoogle()" [disabled]="loading">
          <span class="google-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"/>
            </svg>
          </span>
          Continue with Google
        </button>

        <div class="divider"><span>or use your SafeCity account</span></div>

        <div class="demo-logins">
          <button type="button" (click)="useDemo('citizen')" [disabled]="loading">
            Citizen demo
          </button>
          <button type="button" (click)="useDemo('admin')" [disabled]="loading">
            Admin demo
          </button>
          <button type="button" (click)="useDemo('department')" [disabled]="loading">
            Dept. demo
          </button>
        </div>

        <form (ngSubmit)="submit()" #loginForm="ngForm" class="form">
          <label>
            Username
            <input
              name="username"
              [(ngModel)]="username"
              autocomplete="username"
              placeholder="citizen1 or admin1"
              required
              [disabled]="loading"
            />
          </label>

          <label>
            Password
            <input
              name="password"
              [(ngModel)]="password"
              type="password"
              autocomplete="current-password"
              placeholder="citizen123 or admin123"
              required
              [disabled]="loading"
            />
          </label>

          <p class="error" *ngIf="error">{{ error }}</p>

          <button type="submit" [disabled]="loading || loginForm.invalid">
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="signup-link">
          New citizen account?
          <a routerLink="/signup">Create account</a>
        </p>
      </section>

      <aside class="status-panel">
        <h2>Today at a glance</h2>
        <div>
          <span class="metric">72h</span>
          <span class="label">SLA target</span>
        </div>
        <div>
          <span class="metric">Live</span>
          <span class="label">Incident operations</span>
        </div>
        <div>
          <span class="metric">PDF</span>
          <span class="label">Municipality reports</span>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .login-page {
      min-height:calc(100vh - 60px);
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:2rem;
      background:#071018;
      color:#fff;
      overflow:hidden;
    }
    .login-page:before {
      content:"";
      position:absolute;
      inset:0;
      background:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
      background-size:46px 46px;
      mask-image:linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.2));
    }
    .map-glow {
      position:absolute;
      width:44rem;
      height:44rem;
      right:-12rem;
      top:-10rem;
      background:radial-gradient(circle, rgba(79,195,247,.24), transparent 68%);
      pointer-events:none;
    }
    .login-panel {
      position:relative;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:1.4rem;
      width:min(100%, 28rem);
      padding:2rem;
      background:rgba(12,18,28,.88);
      border:1px solid rgba(255,255,255,.12);
      border-radius:8px;
      box-shadow:0 24px 80px rgba(0,0,0,.45);
      backdrop-filter:blur(20px);
    }
    .brand {
      display:inline-flex;
      align-items:center;
      gap:.7rem;
      color:#fff;
      text-decoration:none;
      font-size:1.05rem;
      width:max-content;
    }
    .brand strong { color:#4fc3f7; }
    .brand-icon {
      width:2.25rem;
      height:2.25rem;
      display:grid;
      place-items:center;
      border-radius:8px;
      background:linear-gradient(135deg, #4fc3f7, #81c784);
      color:#041018;
      font-weight:800;
      letter-spacing:0;
      font-size:1.45rem;
    }
    .copy { max-width:31rem; }
    .eyebrow {
      margin:0 0 .6rem;
      color:#81c784;
      text-transform:uppercase;
      font-size:.75rem;
      font-weight:700;
      letter-spacing:.08em;
    }
    h1 {
      margin:0;
      font-size:2rem;
      line-height:1.05;
      letter-spacing:0;
    }
    .copy p:last-child {
      color:#bac7d3;
      line-height:1.6;
      margin:.9rem 0 0;
    }
    .google-btn {
      height:2.9rem;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:.65rem;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.16);
      background:#fff;
      color:#17212b;
      font-weight:800;
      cursor:pointer;
    }
    .google-icon {
      width:1.2rem;
      height:1.2rem;
      display:inline-flex;
    }
    .google-icon svg {
      width:100%;
      height:100%;
    }
    .divider {
      display:flex;
      align-items:center;
      gap:.7rem;
      color:#7f91a3;
      font-size:.75rem;
    }
    .divider:before,
    .divider:after {
      content:"";
      height:1px;
      flex:1;
      background:rgba(255,255,255,.12);
    }
    .demo-logins {
      display:grid;
      grid-template-columns:1fr 1fr 1fr;
      gap:.6rem;
    }
    .demo-logins button {
      height:2.35rem;
      margin:0;
      border:1px solid rgba(129,199,132,.24);
      background:rgba(129,199,132,.08);
      color:#c8e6c9;
      font-size:.8rem;
    }
    .demo-logins button:hover:not(:disabled) {
      background:rgba(129,199,132,.16);
    }
    .form {
      display:flex;
      flex-direction:column;
      gap:1rem;
      max-width:25rem;
    }
    label {
      display:flex;
      flex-direction:column;
      gap:.4rem;
      color:#dce8f2;
      font-size:.85rem;
      font-weight:600;
    }
    input {
      height:2.8rem;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.07);
      color:#fff;
      padding:0 .85rem;
      font-size:.95rem;
      outline:none;
    }
    input:focus {
      border-color:#4fc3f7;
      box-shadow:0 0 0 3px rgba(79,195,247,.14);
    }
    input::placeholder { color:#70808f; }
    button {
      height:2.8rem;
      border:0;
      border-radius:8px;
      background:#4fc3f7;
      color:#061018;
      font-weight:800;
      cursor:pointer;
      margin-top:.2rem;
    }
    .form button {
      width:100%;
    }
    button:disabled {
      opacity:.55;
      cursor:not-allowed;
    }
    .error {
      margin:0;
      color:#ffb4ad;
      font-size:.85rem;
    }
    .signup-link {
      margin:0;
      text-align:center;
      color:#9fb0bf;
      font-size:.9rem;
    }
    .signup-link a {
      color:#4fc3f7;
      font-weight:800;
      text-decoration:none;
    }
    .status-panel {
      position:absolute;
      right:2rem;
      bottom:2rem;
      width:18rem;
      display:grid;
      gap:1px;
      background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.12);
      border-radius:8px;
      overflow:hidden;
      backdrop-filter:blur(14px);
    }
    .status-panel h2 {
      margin:0;
      padding:.9rem 1rem;
      background:rgba(8,12,20,.82);
      font-size:.9rem;
      color:#dce8f2;
    }
    .status-panel div {
      padding:1rem;
      background:rgba(8,12,20,.74);
      display:flex;
      flex-direction:column;
      gap:.2rem;
    }
    .metric {
      font-size:1.15rem;
      font-weight:800;
      color:#c8e6c9;
    }
    .label {
      color:#aebbc6;
      font-size:.76rem;
    }
    @media (max-width: 860px) {
      .login-page { padding:1rem; }
      .login-panel { min-height:auto; border-right:0; }
      .status-panel { display:none; }
      h1 { font-size:1.8rem; }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const username = this.route.snapshot.queryParamMap.get('username');
    if (username) {
      this.username = username;
    }
  }

  async submit(): Promise<void> {
    if (!this.username.trim() || !this.password) return;

    this.loading = true;
    this.error = '';

    try {
      await this.auth.loginWithPassword(this.username.trim(), this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

      if (returnUrl && returnUrl !== '/login') {
        await this.router.navigateByUrl(returnUrl);
      } else if (this.auth.hasRole('ADMIN')) {
        await this.router.navigate(['/admin/dashboard']);
      } else if (this.auth.hasRole('DEPARTMENT')) {
        await this.router.navigate(['/department/incidents']);
      } else if (this.auth.hasRole('CITIZEN')) {
        await this.router.navigate(['/citizen/report']);
      } else {
        await this.router.navigate(['/unauthorized']);
      }
    } catch {
      this.error = 'Invalid username or password.';
      this.loading = false;
    }
  }

  continueWithGoogle(): void {
    this.auth.loginWithIdentityProvider('google');
  }

  useDemo(type: 'citizen' | 'admin' | 'department'): void {
    if (type === 'admin') {
      this.username = 'admin1';
      this.password = 'admin123';
      return;
    }
    if (type === 'department') {
      this.username = 'roads1';
      this.password = 'roads123';
      return;
    }

    this.username = 'citizen1';
    this.password = 'citizen123';
  }
}
