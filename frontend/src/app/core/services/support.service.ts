import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SupportThreadResponse {
  id: number;
  citizenUsername?: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  relatedIncidentId?: number;
  createdAt: string;
  updatedAt?: string;
  lastMessagePreview?: string;
  unreadForAdmin?: number;
}

export interface SupportMessageResponse {
  id: number;
  threadId: number;
  senderUsername?: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly base = `${environment.apiBaseUrl}/api/support`;

  constructor(private http: HttpClient) {}

  listThreads(): Observable<SupportThreadResponse[]> {
    return this.http.get<SupportThreadResponse[]>(`${this.base}/threads`);
  }

  createThread(subject: string, message: string, relatedIncidentId?: number): Observable<SupportThreadResponse> {
    return this.http.post<SupportThreadResponse>(`${this.base}/threads`, { subject, message, relatedIncidentId });
  }

  getMessages(threadId: number): Observable<SupportMessageResponse[]> {
    return this.http.get<SupportMessageResponse[]>(`${this.base}/threads/${threadId}/messages`);
  }

  reply(threadId: number, body: string): Observable<SupportMessageResponse> {
    return this.http.post<SupportMessageResponse>(`${this.base}/threads/${threadId}/messages`, { body });
  }

  closeThread(threadId: number): Observable<SupportThreadResponse> {
    return this.http.patch<SupportThreadResponse>(`${this.base}/threads/${threadId}/close`, {});
  }
}
