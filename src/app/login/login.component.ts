import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { WsService } from '../services/ws.service';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    imports: [CommonModule, FormsModule],
})
export class LoginComponent implements OnInit {
    username = '';
    password = '';
    loading = false;
    error: string | null = null;

    constructor(
        private auth: AuthService,
        private ws: WsService,
        private http: HttpClient,
        private router: Router
    ) { }

    ngOnInit(): void {
        if (this.auth.isLoggedIn()) {
            try { this.ws.connect(); } catch (e) { /* ignore */ }
        }
    }

    login() {
        this.error = null;
        if (!this.username || !this.password) {
            this.error = 'Veuillez indiquer un nom d\'utilisateur et un mot de passe';
            return;
        }

        this.loading = true;
        this.http.post<any>('http://localhost:8080/api/auth/login', {
            username: this.username,
            password: this.password
        }).subscribe({
            next: (res) => {
                if (res?.token) {
                    this.auth.setSession(res.token, this.username, res.userId ?? res.id ?? null);
                    this.ws.connect();
                    this.router.navigate(['/lobby']);
                } else {
                    this.error = 'Réponse inattendue du serveur.';
                }
            },
            error: (err) => {
                console.error('login error', err);
                this.error = err?.error?.message || 'Échec de la connexion. Vérifiez vos identifiants.';
            },
            complete: () => {
                this.loading = false;
            }
        });
    }

    logout() {
        try { this.ws.disconnect(); } catch (e) { /* ignore */ }
        this.auth.logout();
        this.router.navigate(['/login']);
    }

    isLoggedIn(): boolean {
        return this.auth.isLoggedIn();
    }

    getConnectedUsername(): string {
        return this.auth.getUsername() || this.auth.getUserId() || 'inconnu';
    }
}
