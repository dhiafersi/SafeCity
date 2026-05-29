import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService, DepartmentUserRequest, UserAccount } from '../../../core/services/account.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-page">
      <header>
        <div>
          <p class="eyebrow">Access control</p>
          <h1>User accounts</h1>
          <p>Create technical department accounts and control access without exposing Keycloak screens.</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading">Refresh</button>
      </header>

      <section class="layout">
        <form class="create-panel" #userForm="ngForm" (ngSubmit)="createDepartmentUser()">
          <h2>Create department account</h2>

          <div class="grid">
            <label>
              First name
              <input name="firstName" [(ngModel)]="model.firstName" required [disabled]="saving" />
            </label>
            <label>
              Last name
              <input name="lastName" [(ngModel)]="model.lastName" required [disabled]="saving" />
            </label>
          </div>

          <label>
            Username
            <input name="username" [(ngModel)]="model.username" minlength="3" required [disabled]="saving" />
          </label>

          <label>
            Email
            <input name="email" [(ngModel)]="model.email" type="email" required [disabled]="saving" />
          </label>

          <div class="grid">
            <label>
              Department
              <select name="department" [(ngModel)]="model.department" required [disabled]="saving">
                <option *ngFor="let department of departments" [ngValue]="department">{{ department }}</option>
              </select>
            </label>
            <label>
              Temporary password
              <input name="password" [(ngModel)]="model.password" type="password" minlength="6" required [disabled]="saving" />
            </label>
          </div>

          <p class="error" *ngIf="error">{{ error }}</p>
          <p class="success" *ngIf="success">{{ success }}</p>

          <button type="submit" [disabled]="saving || userForm.invalid">
            {{ saving ? 'Creating...' : 'Create account' }}
          </button>
        </form>

        <section class="table-panel">
          <div class="table-head">
            <h2>Existing users</h2>
            <span>{{ users.length }} accounts</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let user of users">
                  <td>
                    <strong>{{ user.firstName }} {{ user.lastName }}</strong>
                    <span>{{ user.username }} - {{ user.email }}</span>
                  </td>
                  <td>{{ mainRole(user) }}</td>
                  <td>{{ user.department || '-' }}</td>
                  <td>
                    <span class="status" [class.disabled]="!user.enabled">
                      {{ user.enabled ? 'Active' : 'Disabled' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button type="button" (click)="toggle(user)" [disabled]="saving || mainRole(user) === 'ADMIN'">
                      {{ user.enabled ? 'Disable' : 'Activate' }}
                    </button>
                  </td>
                </tr>
                <tr *ngIf="!loading && users.length === 0">
                  <td colspan="5" class="empty">No users found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  `,
  styles: [`
    .users-page {
      min-height:calc(100vh - 60px);
      padding:1.5rem;
      background:#0f0f1a;
      color:#fff;
    }
    header {
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      gap:1rem;
      margin-bottom:1rem;
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
    header p:last-child {
      margin:.4rem 0 0;
      color:#9fb0bf;
    }
    .layout {
      display:grid;
      grid-template-columns:26rem minmax(0, 1fr);
      gap:1rem;
      align-items:start;
    }
    .create-panel, .table-panel {
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-radius:8px;
      padding:1rem;
    }
    h2 { margin:0 0 1rem; font-size:1.05rem; }
    .create-panel {
      display:flex;
      flex-direction:column;
      gap:.9rem;
    }
    .grid {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:.8rem;
    }
    label {
      display:flex;
      flex-direction:column;
      gap:.35rem;
      color:#dce8f2;
      font-size:.82rem;
      font-weight:700;
    }
    input, select {
      height:2.65rem;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.16);
      background:#151d2a;
      color:#fff;
      padding:0 .8rem;
      outline:none;
    }
    input:focus, select:focus {
      border-color:#4fc3f7;
      box-shadow:0 0 0 3px rgba(79,195,247,.14);
    }
    button {
      height:2.55rem;
      border:0;
      border-radius:8px;
      background:#4fc3f7;
      color:#061018;
      font-weight:800;
      cursor:pointer;
      padding:0 .95rem;
    }
    button:disabled { opacity:.55; cursor:not-allowed; }
    header button, .actions button {
      background:rgba(79,195,247,.1);
      color:#b3e5fc;
      border:1px solid rgba(79,195,247,.28);
    }
    .table-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      color:#9fb0bf;
    }
    .table-wrap { overflow:auto; }
    table {
      width:100%;
      border-collapse:collapse;
      min-width:44rem;
    }
    th, td {
      padding:.85rem .75rem;
      border-top:1px solid rgba(255,255,255,.08);
      text-align:left;
      vertical-align:middle;
    }
    th {
      color:#9fb0bf;
      font-size:.72rem;
      text-transform:uppercase;
      letter-spacing:.08em;
    }
    td strong { display:block; color:#fff; margin-bottom:.2rem; }
    td span { color:#9fb0bf; font-size:.82rem; }
    .status {
      display:inline-flex;
      padding:.25rem .55rem;
      border-radius:999px;
      background:rgba(129,199,132,.12);
      color:#c8e6c9;
      font-weight:800;
    }
    .status.disabled {
      background:rgba(255,180,173,.12);
      color:#ffb4ad;
    }
    .actions { text-align:right; }
    .empty { color:#9fb0bf; text-align:center; }
    .error, .success { margin:0; font-size:.86rem; }
    .error { color:#ffb4ad; }
    .success { color:#c8e6c9; }
    @media (max-width: 1000px) {
      .layout { grid-template-columns:1fr; }
    }
    @media (max-width: 680px) {
      .users-page { padding:1rem; }
      header { align-items:flex-start; flex-direction:column; }
      .grid { grid-template-columns:1fr; }
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  readonly departments = ['Roads', 'Water', 'Lighting', 'Waste', 'Parks', 'Traffic'];
  users: UserAccount[] = [];
  loading = false;
  saving = false;
  error = '';
  success = '';

  model: DepartmentUserRequest = this.emptyModel();

  constructor(private accountService: AccountService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.accountService.listUsers().subscribe({
      next: users => {
        this.users = users.sort((a, b) => this.mainRole(a).localeCompare(this.mainRole(b)) || a.username.localeCompare(b.username));
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load users.';
        this.loading = false;
      }
    });
  }

  createDepartmentUser(): void {
    this.saving = true;
    this.error = '';
    this.success = '';

    this.accountService.createDepartmentUser(this.model).subscribe({
      next: user => {
        this.users = [user, ...this.users];
        this.model = this.emptyModel();
        this.success = 'Department account created.';
        this.saving = false;
      },
      error: () => {
        this.error = 'Could not create the account. Check username and email uniqueness.';
        this.saving = false;
      }
    });
  }

  toggle(user: UserAccount): void {
    this.saving = true;
    this.error = '';
    this.success = '';

    this.accountService.setUserEnabled(user.id, !user.enabled).subscribe({
      next: updated => {
        this.users = this.users.map(item => item.id === updated.id ? updated : item);
        this.success = `${updated.username} is now ${updated.enabled ? 'active' : 'disabled'}.`;
        this.saving = false;
      },
      error: () => {
        this.error = 'Could not update user status.';
        this.saving = false;
      }
    });
  }

  mainRole(user: UserAccount): string {
    return user.roles.find(role => ['ADMIN', 'DEPARTMENT', 'CITIZEN'].includes(role)) ?? 'USER';
  }

  private emptyModel(): DepartmentUserRequest {
    return {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      department: 'Roads'
    };
  }
}
