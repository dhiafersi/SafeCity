import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CategoryStat {
  category: string;
  count: number;
}

export interface ResolutionTrendStat {
  date: string;
  averageHours: number;
}

export interface AnalyticsResponse {
  averageResolutionTime: number;
  categorySplit: CategoryStat[];
  resolutionTrend: ResolutionTrendStat[];
  neighborhoodStats: { name: string, count: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private http: HttpClient) {}

  getAnalytics(): Observable<AnalyticsResponse> {
    return this.http.get<AnalyticsResponse>(`${environment.apiBaseUrl}/api/admin/analytics`);
  }
}
