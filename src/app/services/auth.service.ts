import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private api = 'http://localhost:8080/api/auth';
    private tokenKey = 'auth_token';
    private usernameKey = 'username';
    public currentUser$ = new BehaviorSubject<string | null>(localStorage.getItem(this.usernameKey));

    private userIdKey = 'user_id';

    constructor(private http: HttpClient, private router: Router) { }

    register(username: string, password: string, displayName?: string) {
        return this.http.post(this.api + '/register', { username, password, displayName });
    }

    login(username: string, password: string) {
        return this.http.post<any>(this.api + '/login', { username, password });
    }

    setSession(token: string, username: string, userId?: number) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.usernameKey, username);
        if (userId !== undefined && userId !== null) {
            localStorage.setItem(this.userIdKey, String(userId));
        }
        this.currentUser$.next(username);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    getUsername(): string | null {
        return localStorage.getItem(this.usernameKey);
    }

    getUserId(): string | null {
        return localStorage.getItem(this.userIdKey);
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.usernameKey);
        this.currentUser$.next(null);
        this.router.navigate(['/']);
    }
}
