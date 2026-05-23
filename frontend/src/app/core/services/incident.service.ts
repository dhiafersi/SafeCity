import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type IncidentStatus = 'PENDING' | 'VALIDATED' | 'ASSIGNED' | 'FIX_SUBMITTED' | 'RESOLVED' | 'REJECTED';

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
  status: IncidentStatus;
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  governorate?: string;
  delegation?: string;
  aiCategory?: string;
  aiConfidence?: number;
  photoPath?: string;
  createdAt: string;
  updatedAt?: string;
  validatedAt?: string;
  resolvedAt?: string;
  rejectionReason?: string;
  assignedDepartment?: string;
  departmentAssignedAt?: string;
  departmentFixPhotoPath?: string;
  departmentFixSubmittedAt?: string;
  departmentReviewReason?: string;
  slaDeadlineAt?: string;
  duplicateOfIncidentId?: number;
  citizenRating?: number;
  ratedAt?: string;
  slaOverdue?: boolean;
}

export interface AuditLogResponse {
  id: number;
  incidentId: number;
  actionType: string;
  oldValue?: string;
  newValue?: string;
  actorUsername?: string;
  note?: string;
  createdAt: string;
}

export interface CommentResponse {
  id: number;
  incidentId: number;
  authorUsername?: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface DuplicateCheckResponse {
  possibleDuplicate: boolean;
  matches: IncidentResponse[];
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
  status: IncidentStatus;
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly base = `${environment.apiBaseUrl}/api/incidents`;

  constructor(private http: HttpClient) {}

  photoUrl(filename?: string): string | null {
    return filename ? `${environment.apiBaseUrl}/api/uploads/incidents/${filename}` : null;
  }

  createIncident(data: IncidentRequest, photo?: File): Observable<IncidentResponse> {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (photo) form.append('photo', photo);
    return this.http.post<IncidentResponse>(this.base, form);
  }

  checkDuplicate(lat: number, lng: number, category: string): Observable<DuplicateCheckResponse> {
    const params = new HttpParams().set('lat', lat).set('lng', lng).set('category', category);
    return this.http.get<DuplicateCheckResponse>(`${this.base}/check-duplicate`, { params });
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

  getAdminStats(governorate?: string): Observable<any> {
    let params = new HttpParams();
    if (governorate) params = params.set('governorate', governorate);
    return this.http.get<any>(`${environment.apiBaseUrl}/api/admin/stats/summary`, { params });
  }

  getMyIncidents(page = 0, size = 10): Observable<PageResponse<IncidentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<IncidentResponse>>(`${this.base}/my`, { params });
  }

  getDepartmentIncidents(page = 0, size = 20): Observable<PageResponse<IncidentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'createdAt,desc');
    return this.http.get<PageResponse<IncidentResponse>>(`${this.base}/department`, { params });
  }

  getById(id: number): Observable<IncidentResponse> {
    return this.http.get<IncidentResponse>(`${this.base}/${id}`);
  }

  getAudit(id: number): Observable<AuditLogResponse[]> {
    return this.http.get<AuditLogResponse[]>(`${this.base}/${id}/audit`);
  }

  getComments(id: number): Observable<CommentResponse[]> {
    return this.http.get<CommentResponse[]>(`${this.base}/${id}/comments`);
  }

  addComment(id: number, body: string): Observable<CommentResponse> {
    return this.http.post<CommentResponse>(`${this.base}/${id}/comments`, { body });
  }

  updateStatus(id: number, body: StatusUpdateRequest): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/status`, body);
  }

  assignDepartment(id: number, department: string, note?: string): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/assign`, { department, note });
  }

  submitDepartmentFix(id: number, photo: File): Observable<IncidentResponse> {
    const form = new FormData();
    form.append('photo', photo);
    return this.http.post<IncidentResponse>(`${this.base}/${id}/department-fix`, form);
  }

  approveDepartmentFix(id: number): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/department-fix/approve`, {});
  }

  refuseDepartmentFix(id: number, reason: string): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/department-fix/refuse`, { reason });
  }

  reject(id: number, reason: string): Observable<IncidentResponse> {
    return this.http.patch<IncidentResponse>(`${this.base}/${id}/reject`, { reason });
  }

  rate(id: number, rating: number): Observable<IncidentResponse> {
    return this.http.post<IncidentResponse>(`${this.base}/${id}/rate`, { rating });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
