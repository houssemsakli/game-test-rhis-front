import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { WsService } from '../services/ws.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-game-board',
    templateUrl: './game-board.component.html',
    imports: [CommonModule],
    styleUrls: ['./game-board.component.scss']
})
export class GameBoardComponent implements OnInit, OnDestroy {
    board: string[][] = [];
    gameId!: string;
    game: any = null;
    sub: any;
    selectedCell: string | null = null;
    myTurn = false;

    columns = [0, 1, 2, 3, 4, 5, 6, 7];
    columnLabels: string[] = [];

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private ws: WsService,
        private auth: AuthService
    ) {
        for (let i = 0; i < 8; i++) this.columnLabels.push(String.fromCharCode('a'.charCodeAt(0) + i));
    }

    ngOnInit(): void {
        this.gameId = this.route.snapshot.paramMap.get('id')!;
        this.initBoard();

        const gameReq = this.http.get<any>(`http://localhost:8080/api/games/${this.gameId}`);
        const movesReq = this.http.get<any[]>(`http://localhost:8080/api/games/${this.gameId}/moves`);

        forkJoin([gameReq, movesReq]).subscribe({
            next: ([game, moves]) => {
                this.game = game;
                console.debug('[GameBoard] loaded game:', game);
                console.debug('[GameBoard] loaded moves:', moves);
                this.initBoard();
                moves.forEach(m => this.applyMove(m.fromCell, m.toCell));
                this.updateTurn(moves);
            },
            error: (e) => {
                console.error('[GameBoard] Erreur chargement game/moves', e);
            }
        });

        this.ws.connect();
        this.sub = this.ws.subscribeGame(this.gameId, (msg: any) => {
            if (!msg) return;
            if (msg.type === 'MOVE_PLAYED') {
                const mv = msg.move;
                console.debug('[GameBoard] WS MOVE_PLAYED', mv);
                this.applyMove(mv.fromCell, mv.toCell);

                const myId = this.getMyIdNumber();
                const playedBy = this.safeNumber(mv.playedBy, NaN);

                if (!isNaN(playedBy)) {
                    this.myTurn = (playedBy !== myId);
                } else {
                    this.myTurn = !this.myTurn;
                }
            }
        });
    }

    ngOnDestroy(): void {
        if (this.sub) {
            try {
                if (typeof this.sub.unsubscribe === 'function') {
                    this.sub.unsubscribe();
                } else if (typeof this.sub.close === 'function') {
                    this.sub.close();
                } else if (typeof this.sub.disconnect === 'function') {
                    this.sub.disconnect();
                }
            } catch (err) {

            }
        }
    }

    initBoard() {
        this.board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ''));
        for (let c = 0; c < 8; c++) { this.board[1][c] = 'p'; this.board[6][c] = 'P'; }
        this.board[0][0] = 'r'; this.board[0][7] = 'r'; this.board[7][0] = 'R'; this.board[7][7] = 'R';
    }

    applyMove(from: string, to: string) {
        if (!from || !to) return;
        const colFrom = from.charCodeAt(0) - 'a'.charCodeAt(0);
        const rowFrom = 8 - parseInt(from[1], 10);
        const colTo = to.charCodeAt(0) - 'a'.charCodeAt(0);
        const rowTo = 8 - parseInt(to[1], 10);

        if (
            rowFrom < 0 || rowFrom > 7 || colFrom < 0 || colFrom > 7 ||
            rowTo < 0 || rowTo > 7 || colTo < 0 || colTo > 7
        ) return;

        const piece = this.board[rowFrom][colFrom];
        this.board[rowFrom][colFrom] = '';
        this.board[rowTo][colTo] = piece;
    }

    sendMove(from: string, to: string) {
        if (!this.myTurn) {
            console.warn('[GameBoard] Tentative d\'envoi alors que ce n\'est pas votre tour');
            return;
        }

        this.ws.send(`/game/${this.gameId}/move`, { from, to });

        this.myTurn = false;
    }

    getCellName(r: number, c: number): string {
        return this.columnLabels[c] + (8 - r);
    }

    getColumnLabel(c: number): string {
        return this.columnLabels[c];
    }

    onCellClick(r: number, c: number) {
        const cellName = this.getCellName(r, c);

        if (!this.selectedCell) {
            if (!this.board[r][c]) return;
            if (!this.myTurn) {
                console.warn('[GameBoard] Ce n\'est pas votre tour');
                return;
            }
            this.selectedCell = cellName;
            return;
        }

        const from = this.selectedCell;
        const to = cellName;

        this.sendMove(from, to);
        this.selectedCell = null;
    }

    private safeNumber(v: any, fallback = NaN): number {
        if (v === null || v === undefined) return fallback;
        if (typeof v === 'number') return v;
        const n = Number(v);
        return isNaN(n) ? fallback : n;
    }

    private getMyIdNumber(): number {
        const idStr = this.auth.getUserId?.();
        if (!idStr) {
            console.warn('[GameBoard] userId absent dans AuthService/localStorage');
            return NaN;
        }
        return this.safeNumber(idStr, NaN);
    }

    private updateTurn(moves: any[]) {
        const myId = this.getMyIdNumber();
        if (isNaN(myId)) {
            console.warn('[GameBoard] Impossible de déterminer tour : userId introuvable');
            this.myTurn = false;
            return;
        }

        const whiteId = this.game?.whiteUserId != null ? this.safeNumber(this.game.whiteUserId, NaN) : NaN;
        const blackId = this.game?.blackUserId != null ? this.safeNumber(this.game.blackUserId, NaN) : NaN;

        if (!moves || moves.length === 0) {
            if (!isNaN(whiteId)) {
                this.myTurn = (myId === whiteId);
                console.debug('[GameBoard] no moves -> myTurn = (amIWhite?)', this.myTurn);
                return;
            } else {
                console.warn('[GameBoard] Pas d\'IDs blanc/noir assignés sur la game, jeu verrouillé par défaut.');
                this.myTurn = false;
                return;
            }
        }

        const last = moves[moves.length - 1];
        const lastPlayedBy = this.safeNumber(last?.playedBy, NaN);

        if (!isNaN(lastPlayedBy)) {
            this.myTurn = (lastPlayedBy !== myId);
            console.debug('[GameBoard] last.playedBy provided -> myTurn =', this.myTurn);
            return;
        }

        const movesCount = moves.length;
        const toMoveIsWhite = (movesCount % 2 === 0);
        if (!isNaN(whiteId) && !isNaN(blackId)) {
            this.myTurn = toMoveIsWhite ? (myId === whiteId) : (myId === blackId);
        } else {
            console.warn('[GameBoard] Parité utilisée pour tour, mais blanc/noir non assignés -> verrouillage par défaut.');
            this.myTurn = false;
        }
        console.debug('[GameBoard] parity fallback -> myTurn =', this.myTurn);
    }
}
