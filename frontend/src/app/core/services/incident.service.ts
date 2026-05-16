import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IncidentRequest {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  category?: string;
}

export interface IncidentResponse {
  id: number;
  reporterKeycloakId: string;
  reporterUsername: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'VALIDATED' | 'RESOLVED';
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  aiCategory?: string;
  aiConfidence?: number;
  photoPath?: string;
  createdAt: string;
  updatedAt?: string;
  validatedAt?: string;
  resolvedAt?: string;
}

export interface DescriptionResponse {
  description: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface StatusUpdateRequest {
  status: 'PENDING' | 'VALIDATED' | 'RESOLVED';
  adminComment?: string;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly base = `${environment.apiBaseUrl}/api/incidents`;

  constructor(private http: HttpClient) {}

  createIncident(data: IncidentRequest, photo?: File): Observable<IncidentResponse> {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (photo) form.append('photo', photo);
    return this.http.post<IncidentResponse>(this.base, form);
  }

  analyzeImage(photo: File): Observable<{category: string, confidence: number, simulated: boolean, message: string}> {
    const form = new FormData();
    form.append('image', photo);
    return this.http.post<any>(`${environment.apiBaseUrl}/api/ai/analyze`, form);
  }

  generateDescription(category: string, confidence?: number): Observable<DescriptionResponse> {
    return this.http.post<DescriptionResponse>(`${environment.apiBaseUrl}/api/ai/describe`, { category, confidence });
  }

  getAll(page = 0, size = 20): Observable<PageResponse<IncidentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'createdAt,desc');
    return this.http.get<PageResponse<IncidentResponse>>(this.base, { params });
  }

  getMyIncidents(page = 0, size = 10): Observable<PageResponse<IncidentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<IncidentResponse>>(`${this.base}/my`, { params });
  }

  getById(id: number): Observable<IncidentResponse> {
    return this.http.get<IncidentResponse>(`${this.base}/${id}`);
  }

  updateStatus(id: number, body: StatusUpdateRequest): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/status`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
