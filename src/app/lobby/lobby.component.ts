import { Component, OnInit } from '@angular/core';
import { WsService } from '../services/ws.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-lobby',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lobby.component.html'
})
export class LobbyComponent implements OnInit {
    players: string[] = [];
    username?: string | null;

    constructor(private ws: WsService, private auth: AuthService, private router: Router) { }

    ngOnInit(): void {
        this.username = this.auth.getUsername();
        this.ws.connect();
        this.ws.lobby$.subscribe(list => {
            this.players = list.filter((u: string) => u !== this.username);
        });
        this.ws.invites$.subscribe(inv => {
            if (inv) {
                const from = inv.from;
                if (confirm(`${from} t'invite à jouer. Accepter ?`)) {
                    this.ws.send('/app/invite/response', { from, to: this.username, accepted: true });
                } else {
                    this.ws.send('/app/invite/response', { from, to: this.username, accepted: false });
                }
            }
        });
        this.ws.gameCreated$.subscribe(g => {
            if (g && g.gameId) {
                this.router.navigate(['/game', g.gameId]);
            }
        });
    }

    invite(player: string) {
        const from = this.username;
        this.ws.send('/app/invite', { from, to: player });
        alert('Invitation envoyée à ' + player);
    }
}
