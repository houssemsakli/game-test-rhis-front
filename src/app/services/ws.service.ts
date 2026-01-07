import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class WsService {

  private client!: Client;
  private username!: string;

  lobby$ = new BehaviorSubject<string[]>([]);
  invites$ = new BehaviorSubject<any>(null);
  gameCreated$ = new BehaviorSubject<any>(null);

  constructor(private auth: AuthService) { }

  connect() {
    if (this.client?.connected) return;

    const username = this.auth.getUsername();
    if (!username) {
      throw new Error('No username in session');
    }
    this.username = username;

    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      connectHeaders: {
        username
      },
      debug: (str: string) => {
      }
    });

    this.client.onConnect = (frame) => {
      console.log('[WS] connected as', this.username);

      this.client.subscribe('/topic/players', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this.lobby$.next(payload);
        } catch (e) {
          console.error('[WS] error parsing /topic/players', e);
        }
      });

      this.client.subscribe('/user/queue/invite', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /user/queue/invite', payload);
          this.invites$.next(payload);
        } catch (e) {
          console.error('[WS] error parsing /user/queue/invite', e);
        }
      });

      this.client.subscribe('/topic/invites', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /topic/invites received', payload);
          if (payload && payload.to && payload.to === this.username) {
            console.log('[WS] invite for me from', payload.from);
            this.invites$.next(payload);
          } else {
            console.log('[WS] invite not for me (to=', payload?.to, ')');
          }
        } catch (e) {
          console.error('[WS] error parsing /topic/invites', e);
        }
      });

      this.client.subscribe('/topic/invite.response', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /topic/invite.response (fallback):', payload);
          if (payload && payload.to && payload.to === this.username) {
            this.invites$.next(payload);
          }
        } catch (e) {
          console.error('[WS] error parsing /topic/invite.response', e);
        }
      });

      this.client.subscribe('/user/queue/game', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /user/queue/game', payload);
          this.gameCreated$.next(payload);
        } catch (e) {
          console.error('[WS] error parsing /user/queue/game', e);
        }
      });

      this.client.subscribe('/user/queue/game.created', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /user/queue/game.created', payload);
          this.gameCreated$.next(payload);
        } catch (e) {
          console.error('[WS] error parsing /user/queue/game.created', e);
        }
      });

      this.client.subscribe('/topic/game.created', (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          console.log('[WS] /topic/game.created (fallback):', payload);
          if (payload && (payload.to === this.username || payload.from === this.username)) {
            this.gameCreated$.next(payload);
          }
        } catch (e) {
          console.error('[WS] error parsing /topic/game.created', e);
        }
      });

      (window as any).stompClient = this.client;
    };

    this.client.onStompError = (frame) => {
      console.error('[WS] STOMP error', frame);
    };

    this.client.onWebSocketError = (ev: any) => {
      console.error('[WS] WebSocket error', ev);
    };

    this.client.activate();
  }

  subscribeGame(gameId: string, cb: (msg: any) => void): StompSubscription {
    return this.client.subscribe(
      `/topic/game.${gameId}`,
      m => {
        try {
          cb(JSON.parse(m.body));
        } catch (e) {
          console.error('[WS] error parsing game message', e);
        }
      }
    );
  }

  private ensureDestination(dest: string) {
    const okPrefixes = ['/app', '/topic', '/queue', '/user'];
    const hasOk = okPrefixes.some(p => dest.startsWith(p));
    if (hasOk) return dest;
    if (dest.startsWith('/')) return '/app' + dest;
    return '/app/' + dest;
  }

  send(destination: string, body: any) {
    if (!this.client) {
      console.error('[WS] send failed: client not initialized');
      return;
    }
    const dest = this.ensureDestination(destination);
    try {
      this.client.publish({
        destination: dest,
        body: JSON.stringify(body)
      });
      console.log('[WS] published', { destination: dest, body });
    } catch (e) {
      console.error('[WS] publish error', e);
    }
  }

  disconnect() {
    try {
      if (this.client && this.client.connected) {
        this.client.deactivate();
        console.log('[WS] disconnected');
      }
    } catch (e) {
      console.error('[WS] disconnect error', e);
    }
  }
}
