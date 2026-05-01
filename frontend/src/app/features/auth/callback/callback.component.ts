import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Handles the OAuth2 authorization_code redirect from Keycloak.
 * angular-oauth2-oidc processes the code/token in APP_INITIALIZER;
 * this component just redirects to the correct home route based on role.
 */
@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-page">
      <div class="spinner"></div>
      <p>Signing you in…</p>
    </div>
  `,
  styles: [`
    .callback-page {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; height:100vh;
      background:#0f0f1a; color:#aaa; gap:1rem;
    }
    .spinner {
      width:42px; height:42px; border-radius:50%;
      border:3px solid rgba(79,195,247,.15);
      border-top-color:#4fc3f7;
      animation:spin .8s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
  `]
})
export class CallbackComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Give the library a tick to finish processing the code exchange
    setTimeout(() => {
      if (this.auth.hasRole('ADMIN')) {
        this.router.navigate(['/admin/dashboard']);
      } else if (this.auth.hasRole('CITIZEN')) {
        this.router.navigate(['/citizen/report']);
      } else {
        this.router.navigate(['/unauthorized']);
      }
    }, 800);
  }
}
