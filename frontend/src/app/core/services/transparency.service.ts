import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TransparencyStats {
  totalReports: number;
  pendingCount: number;
  validatedCount: number;
  resolvedCount: number;
  rejectedCount: number;
  overdueCount: number;
  averageResolutionHours: number;
  averageCitizenRating: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class TransparencyService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<TransparencyStats> {
    return this.http.get<TransparencyStats>(`${environment.apiBaseUrl}/api/public/transparency`);
  }
}
