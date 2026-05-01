import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
    ]
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

