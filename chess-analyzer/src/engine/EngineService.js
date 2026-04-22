const WORKER_PATH = '/stockfish-18-lite-single.js'; // Served from public folder
const WASM_INIT_DELAY_MS = 200;
const DEFAULT_DEPTH = 18;
const MAX_RESTART = 3;

const RE_UCIOK = /^uciok$/;
const RE_READYOK = /^readyok$/;
const RE_INFO = /^info /;
const RE_BESTMOVE = /^bestmove (?<move>\S+)(?:\s+ponder (?<ponder>\S+))?/;
const RE_CP = /score cp (?<cp>-?\d+)/;
const RE_MATE = /score mate (?<mate>-?\d+)/;
const RE_DEPTH = /\bdepth (?<depth>\d+)/;
const RE_PV = / pv (?<pv>.+)/;

class EngineService {
    #worker = null;
    #state = 'IDLE';
    #restartCount = 0;
    #initResolve = null;
    #initReject = null;
    #evalResolve = null;
    #evalReject = null;
    #currentFen = null;
    #latestEval = this.#blankEval();

    init() {
        if (this.#state !== 'IDLE') return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.#initResolve = resolve;
            this.#initReject = reject;
            this.#spawnWorker();
        });
    }

    evaluate(fen, depth = DEFAULT_DEPTH) {
        if (this.#state === 'IDLE' || this.#state === 'INITIALISING' || this.#state === 'SYNCHRONISING') {
            return Promise.reject(new Error(`Engine not ready (state: ${this.#state}). Wait for init() to resolve.`));
        }
        if (this.#state === 'SEARCHING') {
            this.#send('stop');
            if (this.#evalReject) {
                this.#evalReject(new Error('Search cancelled: new evaluate() call.'));
                this.#evalReject = null;
            }
        }

        this.#currentFen = fen;
        this.#latestEval = this.#blankEval();
        this.#state = 'SEARCHING';

        return new Promise((resolve, reject) => {
            this.#evalResolve = resolve;
            this.#evalReject = reject;
            this.#send('ucinewgame');
            this.#send(`position fen ${fen}`);
            this.#send(`go depth ${depth}`);
        });
    }

    stop() {
        if (this.#state === 'SEARCHING') this.#send('stop');
    }

    terminate() {
        this.#killWorker();
        this.#state = 'IDLE';
        this.#restartCount = 0;
    }

    #spawnWorker() {
        this.#killWorker();
        this.#state = 'INITIALISING';
        this.#worker = new Worker(WORKER_PATH);
        this.#worker.onmessage = (e) => this.#onMessage(e.data);
        this.#worker.onerror = (e) => this.#onError(e);

        setTimeout(() => {
            if (this.#state === 'INITIALISING') this.#send('uci');
        }, WASM_INIT_DELAY_MS);
    }

    #killWorker() {
        if (this.#worker) {
            this.#worker.onmessage = null;
            this.#worker.onerror = null;
            this.#worker.terminate();
            this.#worker = null;
        }
    }

    #send(cmd) {
        if (this.#worker) this.#worker.postMessage(cmd);
    }

    #onMessage(line) {
        if (typeof line !== 'string') return;
        if (RE_UCIOK.test(line)) {
            this.#state = 'SYNCHRONISING';
            this.#send('isready');
            return;
        }
        if (RE_READYOK.test(line)) {
            this.#state = 'READY';
            this.#restartCount = 0;
            if (this.#initResolve) {
                this.#initResolve();
                this.#initResolve = null;
            }
            return;
        }
        if (RE_INFO.test(line)) {
            this.#parseInfo(line);
            return;
        }
        const bmMatch = RE_BESTMOVE.exec(line);
        if (bmMatch) {
            const { move, ponder } = bmMatch.groups;
            this.#state = 'READY';
            if (this.#evalResolve) {
                this.#evalResolve({
                    fen: this.#currentFen,
                    depth: this.#latestEval.depth,
                    cp: this.#latestEval.cp,
                    mate: this.#latestEval.mate,
                    bestMove: move === '(none)' ? null : move,
                    ponder: ponder ?? null,
                    pv: this.#latestEval.pv,
                });
                this.#evalResolve = null;
            }
        }
    }

    #parseInfo(line) {
        const depthMatch = RE_DEPTH.exec(line);
        if (!depthMatch) return;
        const depth = parseInt(depthMatch.groups.depth, 10);
        if (depth < this.#latestEval.depth) return;

        const cpMatch = RE_CP.exec(line);
        const mateMatch = RE_MATE.exec(line);
        const pvMatch = RE_PV.exec(line);

        this.#latestEval.depth = depth;
        if (mateMatch) {
            this.#latestEval.mate = parseInt(mateMatch.groups.mate, 10);
            this.#latestEval.cp = null;
        } else if (cpMatch) {
            this.#latestEval.cp = parseInt(cpMatch.groups.cp, 10);
            this.#latestEval.mate = null;
        }
        if (pvMatch) this.#latestEval.pv = pvMatch.groups.pv.trim().split(' ');
    }

    #onError(e) {
        if (this.#restartCount < MAX_RESTART) {
            this.#restartCount++;
            if (this.#evalReject) {
                this.#evalReject(new Error(`Worker restarted`));
                this.#evalReject = null;
                this.#evalResolve = null;
            }
            this.#latestEval = this.#blankEval();
            this.#spawnWorker();
        } else {
            if (this.#initReject) this.#initReject(new Error("Max restarts reached"));
            if (this.#evalReject) this.#evalReject(new Error("Max restarts reached"));
            this.#killWorker();
            this.#state = 'IDLE';
        }
    }

    #blankEval() {
        return { cp: null, mate: null, depth: 0, pv: [], bestMove: null, ponder: null };
    }
}

export const engineService = new EngineService();