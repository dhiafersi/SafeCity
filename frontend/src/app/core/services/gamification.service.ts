import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CitizenPointsResponse {
  citizenKeycloakId: string;
  citizenUsername?: string;
  totalPoints: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  constructor(private http: HttpClient) {}

  getMyPoints(): Observable<CitizenPointsResponse> {
    return this.http.get<CitizenPointsResponse>(
      `${environment.apiBaseUrl}/api/gamification/points`
    );
  }

  getHeatmapData(): Observable<HeatmapPoint[]> {
    return this.http.get<HeatmapPoint[]>(
      `${environment.apiBaseUrl}/api/admin/heatmap`
    );
  }

  getPublicLeaderboard(): Observable<CitizenPointsResponse[]> {
    return this.http.get<CitizenPointsResponse[]>(
      `${environment.apiBaseUrl}/api/public/leaderboard`
    );
  }
}
