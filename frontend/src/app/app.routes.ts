import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { ProfileComponent } from './features/profile/profile.component';

export const routes: Routes = [
  /**
   * Public, map-first landing page.
   * Visible for everyone (no auth guard).
   */
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/public-map/public-map.component')
        .then(m => m.PublicMapComponent),
    title: 'SafeCity – Live Incident Map'
  },
  {
    path: 'citizen',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CITIZEN'] },
    children: [
      {
        path: 'report',
        loadComponent: () =>
          import('./features/citizen/report-incident/report-incident.component')
            .then(m => m.ReportIncidentComponent),
        title: 'Report an Incident – SafeCity'
      },
      {
        path: 'my-reports',
        loadComponent: () =>
          import('./features/citizen/my-reports/my-reports.component')
            .then(m => m.MyReportsComponent),
        title: 'My Reports – SafeCity'
      },
      {
        path: 'points',
        loadComponent: () =>
          import('./features/citizen/points/points.component')
            .then(m => m.PointsComponent),
        title: 'My Impact Points – SafeCity'
      },
      {
        path: 'my-reports/:id',
        loadComponent: () =>
          import('./features/shared/incident-detail/incident-detail.component')
            .then(m => m.IncidentDetailComponent),
        title: 'Report Details – SafeCity'
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/shared/support-chat/support-chat.component')
            .then(m => m.SupportChatComponent),
        title: 'Support – SafeCity'
      },
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component')
            .then(m => m.DashboardComponent),
        title: 'Admin Dashboard – SafeCity'
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/admin/incidents-list/incidents-list.component')
            .then(m => m.IncidentsListComponent),
        title: 'Manage Incidents – SafeCity'
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/admin/analytics/analytics.component')
            .then(m => m.AnalyticsDashboardComponent),
        title: 'City Analytics – SafeCity'
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/admin-users.component')
            .then(m => m.AdminUsersComponent),
        title: 'User Accounts - SafeCity'
      },
      {
        path: 'incidents/:id',
        loadComponent: () =>
          import('./features/shared/incident-detail/incident-detail.component')
            .then(m => m.IncidentDetailComponent),
        title: 'Incident Details – SafeCity'
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/shared/support-chat/support-chat.component')
            .then(m => m.SupportChatComponent),
        title: 'Admin Support – SafeCity'
      },
    ]
  },
  {
    path: 'department',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DEPARTMENT'] },
    children: [
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/department/department-incidents/department-incidents.component')
            .then(m => m.DepartmentIncidentsComponent),
        title: 'Department Queue - SafeCity'
      },
      {
        path: 'incidents/:id',
        loadComponent: () =>
          import('./features/shared/incident-detail/incident-detail.component')
            .then(m => m.IncidentDetailComponent),
        title: 'Assigned Incident - SafeCity'
      },
    ]
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Sign in - SafeCity'
  },
  {
    path: 'signup',
    component: SignupComponent,
    title: 'Create account - SafeCity'
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    component: ProfileComponent,
    title: 'My Profile - SafeCity'
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./features/auth/callback/callback.component')
        .then(m => m.CallbackComponent)
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component')
        .then(m => m.UnauthorizedComponent),
    title: 'Access Denied – SafeCity'
  },
  { path: '**', redirectTo: '' }
];
