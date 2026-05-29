import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService, ProfileUpdateRequest, UserAccount } from '../../core/services/account.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-page">
      <header>
        <div>
          <p class="eyebrow">Account settings</p>
          <h1>My profile</h1>
        </div>
        <span class="role">{{ roleLabel }}</span>
      </header>

      <section class="profile-layout">
        <aside class="summary">
          <div class="avatar">{{ initials }}</div>
          <h2>{{ account?.firstName }} {{ account?.lastName }}</h2>
          <p>{{ account?.username }}</p>
          <div class="meta">
            <span>{{ account?.email }}</span>
            <span *ngIf="account?.department">Department: {{ account?.department }}</span>
            <span>Status: {{ account?.enabled ? 'Active' : 'Disabled' }}</span>
          </div>
        </aside>

        <form class="form" #profileForm="ngForm" (ngSubmit)="save()">
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
            Email
            <input name="email" [(ngModel)]="model.email" type="email" required [disabled]="loading" />
          </label>

          <label>
            Phone
            <input name="phone" [(ngModel)]="model.phone" autocomplete="tel" [disabled]="loading" />
          </label>

          <p class="error" *ngIf="error">{{ error }}</p>
          <p class="success" *ngIf="success">{{ success }}</p>

          <button type="submit" [disabled]="loading || profileForm.invalid">
            {{ loading ? 'Saving...' : 'Save changes' }}
          </button>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .profile-page {
      min-height:calc(100vh - 60px);
      padding:2rem;
      background:#0f0f1a;
      color:#fff;
    }
    header {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:1rem;
      max-width:70rem;
      margin:0 auto 1.25rem;
    }
    .eyebrow {
      margin:0 0 .35rem;
      color:#81c784;
      text-transform:uppercase;
      font-size:.75rem;
      font-weight:800;
      letter-spacing:.08em;
    }
    h1 { margin:0; font-size:2rem; letter-spacing:0; }
    .role {
      padding:.4rem .8rem;
      border-radius:999px;
      background:rgba(79,195,247,.12);
      border:1px solid rgba(79,195,247,.28);
      color:#b3e5fc;
      font-weight:800;
      font-size:.78rem;
      text-transform:uppercase;
    }
    .profile-layout {
      max-width:70rem;
      margin:0 auto;
      display:grid;
      grid-template-columns:20rem 1fr;
      gap:1rem;
    }
    .summary, .form {
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-radius:8px;
      padding:1.25rem;
    }
    .avatar {
      width:5rem;
      height:5rem;
      display:grid;
      place-items:center;
      border-radius:8px;
      background:linear-gradient(135deg, #4fc3f7, #81c784);
      color:#061018;
      font-size:1.6rem;
      font-weight:900;
      margin-bottom:1rem;
    }
    .summary h2 { margin:0; font-size:1.25rem; }
    .summary p { margin:.35rem 0 1rem; color:#9fb0bf; }
    .meta { display:flex; flex-direction:column; gap:.55rem; color:#d4e2ed; font-size:.9rem; }
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
      width:max-content;
      min-width:10rem;
      height:2.8rem;
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
    @media (max-width: 820px) {
      .profile-page { padding:1rem; }
      header { align-items:flex-start; flex-direction:column; }
      .profile-layout { grid-template-columns:1fr; }
      .grid { grid-template-columns:1fr; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  account?: UserAccount;
  model: ProfileUpdateRequest = { firstName: '', lastName: '', email: '', phone: '' };
  loading = false;
  error = '';
  success = '';

  constructor(private accountService: AccountService) {}

  get initials(): string {
    const first = this.account?.firstName?.[0] ?? '';
    const last = this.account?.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || 'SC';
  }

  get roleLabel(): string {
    return this.account?.roles?.[0] ?? 'User';
  }

  ngOnInit(): void {
    this.load();
  }

  save(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.accountService.updateProfile(this.model).subscribe({
      next: account => {
        this.account = account;
        this.model = {
          firstName: account.firstName ?? '',
          lastName: account.lastName ?? '',
          email: account.email ?? '',
          phone: account.phone ?? ''
        };
        this.success = 'Profile updated.';
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not update your profile.';
        this.loading = false;
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.accountService.getProfile().subscribe({
      next: account => {
        this.account = account;
        this.model = {
          firstName: account.firstName ?? '',
          lastName: account.lastName ?? '',
          email: account.email ?? '',
          phone: account.phone ?? ''
        };
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load your profile.';
        this.loading = false;
      }
    });
  }
}
