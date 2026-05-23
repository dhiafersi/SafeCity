import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService, SupportThreadResponse, SupportMessageResponse } from '../../../core/services/support.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-support-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="support-page">
      <h1>💬 Support</h1>
      <p class="subtitle">{{ isAdmin ? 'Reply to citizen messages' : 'Contact the SafeCity administration' }}</p>

      <div class="layout">
        <aside class="thread-list">
          <button *ngIf="!isAdmin" class="btn-new" (click)="showNew = !showNew">+ New conversation</button>
          <div class="new-thread" *ngIf="showNew && !isAdmin">
            <input [(ngModel)]="newSubject" placeholder="Subject" />
            <textarea [(ngModel)]="newMessage" placeholder="Your message"></textarea>
            <button (click)="createThread()">Start</button>
          </div>
          <div class="thread-item"
               *ngFor="let t of threads"
               [class.active]="selected?.id === t.id"
               (click)="selectThread(t)">
            <strong>{{ t.subject }}</strong>
            <span class="status" [class.closed]="t.status === 'CLOSED'">{{ t.status }}</span>
            <p *ngIf="isAdmin">{{ t.citizenUsername }}</p>
            <small>{{ t.lastMessagePreview }}</small>
            <span class="unread" *ngIf="isAdmin && t.unreadForAdmin">{{ t.unreadForAdmin }} new</span>
          </div>
        </aside>

        <main class="chat-panel" *ngIf="selected">
          <header>
            <h2>{{ selected.subject }}</h2>
            <button *ngIf="isAdmin && selected.status === 'OPEN'" (click)="close()">Close thread</button>
          </header>
          <div class="messages">
            <div *ngFor="let m of messages" class="msg" [class.admin]="m.senderRole === 'ADMIN'">
              <strong>{{ m.senderUsername }} ({{ m.senderRole }})</strong>
              <span class="time">{{ m.createdAt | date:'short' }}</span>
              <p>{{ m.body }}</p>
            </div>
          </div>
          <div class="reply" *ngIf="selected.status === 'OPEN'">
            <textarea [(ngModel)]="replyBody" placeholder="Type your reply…"></textarea>
            <button (click)="sendReply()" [disabled]="!replyBody.trim()">Send</button>
          </div>
          <p *ngIf="selected.status === 'CLOSED'" class="closed-note">This conversation is closed.</p>
        </main>
        <main class="chat-panel empty" *ngIf="!selected">
          <p>Select a conversation</p>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .support-page { padding:1.5rem; background:#0f0f1a; min-height:calc(100vh - 60px); color:#fff; }
    h1 { margin:0 0 .25rem; }
    .subtitle { color:#888; margin-bottom:1rem; }
    .layout { display:grid; grid-template-columns:280px 1fr; gap:1rem; min-height:500px; }
    .thread-list { background:rgba(255,255,255,.04); border-radius:12px; padding:.75rem; overflow-y:auto; }
    .thread-item { padding:.65rem; border-radius:8px; cursor:pointer; margin-bottom:.35rem; border:1px solid transparent; }
    .thread-item:hover, .thread-item.active { background:rgba(79,195,247,.08); border-color:rgba(79,195,247,.25); }
    .thread-item .status { font-size:.65rem; color:#81c784; }
    .thread-item .status.closed { color:#888; }
    .thread-item small { display:block; color:#666; font-size:.75rem; margin-top:.25rem; }
    .unread { background:#ef5350; color:#fff; font-size:.65rem; padding:.1rem .4rem; border-radius:10px; }
    .btn-new, .new-thread button, .reply button { padding:.4rem .8rem; border-radius:8px; border:none; background:#4fc3f7; color:#0f0f1a; cursor:pointer; margin-bottom:.5rem; }
    .new-thread input, .new-thread textarea, .reply textarea {
      width:100%; margin:.35rem 0; background:#1a1a2e; color:#fff; border:1px solid rgba(255,255,255,.12);
      border-radius:8px; padding:.5rem;
    }
    .chat-panel { background:rgba(255,255,255,.04); border-radius:12px; padding:1rem; display:flex; flex-direction:column; }
    .chat-panel.empty { align-items:center; justify-content:center; color:#666; }
    .messages { flex:1; overflow-y:auto; margin:1rem 0; }
    .msg { margin-bottom:.75rem; padding:.5rem; border-radius:8px; background:rgba(255,255,255,.03); }
    .msg.admin { border-left:3px solid #4fc3f7; }
    .msg .time { float:right; font-size:.7rem; color:#666; }
    .reply textarea { width:100%; min-height:60px; background:#1a1a2e; color:#fff; border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:.5rem; }
    .closed-note { color:#888; font-size:.85rem; }
    @media (max-width:768px) { .layout { grid-template-columns:1fr; } }
  `]
})
export class SupportChatComponent implements OnInit {
  threads: SupportThreadResponse[] = [];
  selected?: SupportThreadResponse;
  messages: SupportMessageResponse[] = [];
  isAdmin = false;
  showNew = false;
  newSubject = '';
  newMessage = '';
  replyBody = '';

  constructor(private support: SupportService, private auth: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.hasRole('ADMIN');
    this.loadThreads();
  }

  loadThreads(): void {
    this.support.listThreads().subscribe(t => this.threads = t);
  }

  selectThread(t: SupportThreadResponse): void {
    this.selected = t;
    this.support.getMessages(t.id).subscribe(m => this.messages = m);
  }

  createThread(): void {
    if (!this.newSubject.trim() || !this.newMessage.trim()) return;
    this.support.createThread(this.newSubject.trim(), this.newMessage.trim()).subscribe(t => {
      this.showNew = false;
      this.newSubject = '';
      this.newMessage = '';
      this.loadThreads();
      this.selectThread(t);
    });
  }

  sendReply(): void {
    if (!this.selected || !this.replyBody.trim()) return;
    this.support.reply(this.selected.id, this.replyBody.trim()).subscribe(m => {
      this.messages = [...this.messages, m];
      this.replyBody = '';
      this.loadThreads();
    });
  }

  close(): void {
    if (!this.selected) return;
    this.support.closeThread(this.selected.id).subscribe(t => {
      this.selected = t;
      this.loadThreads();
    });
  }
}
