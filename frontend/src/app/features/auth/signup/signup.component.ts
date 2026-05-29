import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountService, RegisterRequest } from '../../../core/services/account.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="signup-page">
      <section class="panel">
        <a routerLink="/" class="brand">
          <span class="brand-icon">+</span>
          <span>SafeCity<strong>Connect</strong></span>
        </a>

        <div class="copy">
          <p class="eyebrow">Citizen access</p>
          <h1>Create your account</h1>
          <p>Join the reporting portal and follow every incident you submit from validation to resolution.</p>
        </div>

        <form #signupForm="ngForm" (ngSubmit)="submit()" class="form">
          <div class="grid">
            <label>
              First name
              <input name="firstName" [(ngModel)]="model.firstName" required [disabled]="loading" />
            </label>
            <label>
              Last name
              <input name="lastName" [(ngModel)]="model.lastName" required [disabled]="loading" />
            </label>
          </div>

          <label>
            Username
            <input name="username" [(ngModel)]="model.username" minlength="3" required [disabled]="loading" />
          </label>

          <label>
            Email
            <input name="email" [(ngModel)]="model.email" type="email" required [disabled]="loading" />
          </label>

          <label>
            Phone
            <input name="phone" [(ngModel)]="model.phone" autocomplete="tel" [disabled]="loading" />
          </label>

          <div class="grid">
            <label>
              Password
              <input name="password" [(ngModel)]="model.password" type="password" minlength="6" required [disabled]="loading" />
            </label>
            <label>
              Confirm password
              <input name="confirmPassword" [(ngModel)]="confirmPassword" type="password" required [disabled]="loading" />
            </label>
          </div>

          <p class="error" *ngIf="error">{{ error }}</p>
          <p class="success" *ngIf="success">{{ success }}</p>

          <button type="submit" [disabled]="loading || signupForm.invalid">
            {{ loading ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="switch">
          Already have an account?
          <a routerLink="/login">Sign in</a>
        </p>
      </section>
    </div>
  `,
  styles: [`
    .signup-page {
      min-height:calc(100vh - 60px);
      display:grid;
      place-items:center;
      padding:2rem;
      background:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
        #071018;
      background-size:46px 46px;
      color:#fff;
    }
    .panel {
      width:min(100%, 38rem);
      padding:2rem;
      background:rgba(12,18,28,.9);
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
      margin-bottom:1.35rem;
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
      font-size:1.45rem;
    }
    .eyebrow {
      margin:0 0 .55rem;
      color:#81c784;
      text-transform:uppercase;
      font-size:.75rem;
      font-weight:800;
      letter-spacing:.08em;
    }
    h1 { margin:0; font-size:2rem; letter-spacing:0; }
    .copy p:last-child {
      margin:.75rem 0 1.4rem;
      color:#bac7d3;
      line-height:1.6;
    }
    .form { display:flex; flex-direction:column; gap:1rem; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    label {
      display:flex;
      flex-direction:column;
      gap:.4rem;
      color:#dce8f2;
      font-size:.85rem;
      font-weight:700;
    }
    input {
      height:2.8rem;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.07);
      color:#fff;
      padding:0 .85rem;
      outline:none;
    }
    input:focus {
      border-color:#4fc3f7;
      box-shadow:0 0 0 3px rgba(79,195,247,.14);
    }
    button {
      height:2.9rem;
      border:0;
      border-radius:8px;
      background:#4fc3f7;
      color:#061018;
      font-weight:800;
      cursor:pointer;
    }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .error, .success { margin:0; font-size:.88rem; }
    .error { color:#ffb4ad; }
    .success { color:#c8e6c9; }
    .switch {
      margin:1.2rem 0 0;
      color:#9fb0bf;
      text-align:center;
    }
    .switch a { color:#4fc3f7; font-weight:800; text-decoration:none; }
    @media (max-width: 720px) {
      .signup-page { padding:1rem; }
      .panel { padding:1.25rem; }
      .grid { grid-template-columns:1fr; }
      h1 { font-size:1.75rem; }
    }
  `]
})
export class SignupComponent {
  model: RegisterRequest = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    phone: ''
  };
  confirmPassword = '';
  loading = false;
  error = '';
  success = '';

  constructor(private accountService: AccountService, private router: Router) {}

  submit(): void {
    this.error = '';
    this.success = '';

    if (this.model.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.accountService.registerCitizen(this.model).subscribe({
      next: () => {
        this.success = 'Account created. Redirecting to sign in...';
        setTimeout(() => this.router.navigate(['/login'], { queryParams: { username: this.model.username } }), 900);
      },
      error: () => {
        this.error = 'Could not create this account. Try another username or email.';
        this.loading = false;
      }
    });
  }
}
