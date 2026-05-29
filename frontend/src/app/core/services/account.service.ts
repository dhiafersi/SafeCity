import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserAccount {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  enabled: boolean;
  department?: string;
  roles: string[];
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
}

export interface ProfileUpdateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface DepartmentUserRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  department: string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  registerCitizen(payload: RegisterRequest): Observable<UserAccount> {
    return this.http.post<UserAccount>(`${this.base}/api/auth/register`, payload);
  }

  getProfile(): Observable<UserAccount> {
    return this.http.get<UserAccount>(`${this.base}/api/profile`);
  }

  updateProfile(payload: ProfileUpdateRequest): Observable<UserAccount> {
    return this.http.put<UserAccount>(`${this.base}/api/profile`, payload);
  }

  listUsers(): Observable<UserAccount[]> {
    return this.http.get<UserAccount[]>(`${this.base}/api/admin/users`);
  }

  createDepartmentUser(payload: DepartmentUserRequest): Observable<UserAccount> {
    return this.http.post<UserAccount>(`${this.base}/api/admin/users/department`, payload);
  }

  setUserEnabled(id: string, enabled: boolean): Observable<UserAccount> {
    return this.http.patch<UserAccount>(`${this.base}/api/admin/users/${id}/status`, { enabled });
  }
}
