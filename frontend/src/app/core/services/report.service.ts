import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly base = `${environment.apiBaseUrl}/api/admin/reports`;

  constructor(private http: HttpClient) {}

  downloadPeriodReport(from: string, to: string): Observable<Blob> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get(`${this.base}/incidents.pdf`, { params, responseType: 'blob' });
  }

  downloadIncidentDossier(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/incident/${id}.pdf`, { responseType: 'blob' });
  }

  saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
