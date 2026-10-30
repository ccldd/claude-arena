import { DurableObject } from 'cloudflare:workers';
import {
  DEFAULT_MAX_TURNS,
  MAX_MESSAGE_LENGTH,
  MAX_TOPIC_LENGTH,
  MAX_TURNS_LIMIT,
  type Control,
  type Message,
  type RoomView,
  type Status,
} from '../shared/types';

/** Long-polls return before common client timeouts (60s) are hit. */
export const WAIT_MS = 45_000;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface Seat {
  name: string;
  token: string;
}

interface State {
  code: string;
  topic: string;
  maxTurns: number;
  seats: (Seat | null)[];
  turn: number;
  messages: Message[];
  paused: boolean;
  endReason?: string;
}

export type WaitResult =
  | {
      kind: 'your_turn';
      topic: string;
      you: string;
      other: string;
      turnNumber: number;
      maxTurns: number;
      last?: Message;
    }
  | { kind: 'waiting'; reason: string }
  | { kind: 'over'; reason: string }
  | { kind: 'error'; error: string };

export type SayResult =
  | { kind: 'sent'; remaining: number }
  | { kind: 'over'; reason: string }
  | { kind: 'error'; error: string };

export interface CreateOptions {
  code: string;
  topic?: string;
  maxTurns?: number;
  /** Set when a Claude creates the room and takes seat 1 straight away. */
  creatorName?: string;
}

export class Room extends DurableObject<Env> {
  private state: State | null = null;
  private waiters = new Set<() => void>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<State>('state')) ?? null;
    });
  }

  async create(opts: CreateOptions): Promise<{ ok: false } | { ok: true; token?: string }> {
    if (this.state) return { ok: false };
    this.state = {
      code: opts.code,
      topic: cleanTopic(opts.topic),
      maxTurns: clampTurns(opts.maxTurns),
      seats: [null, null],
      turn: 0,
      messages: [],
      paused: false,
    };
    const token = opts.creatorName !== undefined ? this.takeSeat(0, opts.creatorName) : undefined;
    await this.ctx.storage.setAlarm(Date.now() + EXPIRY_MS);
    await this.commit();
    return { ok: true, token };
  }

  async join(name: string): Promise<{ token: string; seat: number } | { error: string }> {
    const s = this.state;
    if (!s) return { error: 'No room with that code.' };
    if (s.endReason) return { error: 'That room has already finished.' };
    const seat = s.seats.findIndex((x) => x === null);
    if (seat < 0) return { error: 'Both seats in that room are taken.' };
    const token = this.takeSeat(seat, name);
    await this.commit();
    return { token, seat };
  }

  waitForTurn(token: string): Promise<WaitResult> {
    const seat = this.seatOf(token);
    if (seat < 0) return Promise.resolve({ kind: 'error', error: 'Unknown seat token.' });
    return new Promise((resolve) => {
      const now = this.turnFor(seat);
      if (now) return resolve(now);
      const check = () => {
        const result = this.turnFor(seat);
        if (!result) return;
        clearTimeout(timer);
        this.waiters.delete(check);
        resolve(result);
      };
      const timer = setTimeout(() => {
        this.waiters.delete(check);
        resolve({ kind: 'waiting', reason: this.waitReason(seat) });
      }, WAIT_MS);
      this.waiters.add(check);
    });
  }

  async say(token: string, text: string): Promise<SayResult> {
    const s = this.state;
    const seat = this.seatOf(token);
    if (!s || seat < 0) return { kind: 'error', error: 'Unknown seat token.' };
    if (s.endReason) return { kind: 'over', reason: s.endReason };
    if (this.status() !== 'running' || s.turn !== seat) {
      return { kind: 'error', error: 'It is not your turn. Call wait_for_turn first.' };
    }
    const body = text.trim();
    if (!body) return { kind: 'error', error: 'The message is empty.' };
    s.messages.push({
      seat,
      name: s.seats[seat]!.name,
      text: body.slice(0, MAX_MESSAGE_LENGTH),
      at: Date.now(),
    });
    s.turn = 1 - seat;
    if (s.messages.length >= s.maxTurns) s.endReason = `Reached the ${s.maxTurns}-message limit.`;
    await this.commit();
    return s.endReason
      ? { kind: 'over', reason: s.endReason }
      : { kind: 'sent', remaining: s.maxTurns - s.messages.length };
  }

  async control(c: Control): Promise<RoomView | { error: string }> {
    const s = this.state;
    if (!s) return { error: 'No room with that code.' };
    if (s.endReason) return { error: 'This room has finished.' };
    if (c.action === 'topic') s.topic = cleanTopic(c.topic);
    else if (c.action === 'pause') s.paused = true;
    else if (c.action === 'resume') s.paused = false;
    else if (c.action === 'stop') s.endReason = 'Stopped by a viewer.';
    await this.commit();
    return this.view()!;
  }

  view(): RoomView | null {
    const s = this.state;
    if (!s) return null;
    return {
      code: s.code,
      topic: s.topic,
      maxTurns: s.maxTurns,
      status: this.status(),
      turn: s.turn,
      seats: s.seats.map((x) => (x ? { name: x.name } : null)),
      messages: s.messages,
      endReason: s.endReason,
    };
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket' || !this.state) {
      return new Response('Expected a websocket for an existing room', { status: 400 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.view()));
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.state = null;
  }

  private status(): Status {
    const s = this.state!;
    if (s.endReason) return 'over';
    if (!s.topic || s.seats.some((x) => x === null)) return 'waiting';
    return s.paused ? 'paused' : 'running';
  }

  private turnFor(seat: number): WaitResult | null {
    const s = this.state!;
    if (s.endReason) return { kind: 'over', reason: s.endReason };
    if (this.status() !== 'running' || s.turn !== seat) return null;
    return {
      kind: 'your_turn',
      topic: s.topic,
      you: s.seats[seat]!.name,
      other: s.seats[1 - seat]!.name,
      turnNumber: s.messages.length + 1,
      maxTurns: s.maxTurns,
      last: s.messages.at(-1),
    };
  }

  private waitReason(seat: number): string {
    const s = this.state!;
    if (s.seats.some((x) => x === null)) return 'The other Claude has not joined yet.';
    if (!s.topic) return 'No topic yet. A human needs to set one on the website.';
    if (s.paused) return 'A viewer paused the conversation.';
    return `${s.seats[1 - seat]!.name} is still writing.`;
  }

  private takeSeat(seat: number, name: string): string {
    const s = this.state!;
    const other = s.seats[1 - seat]?.name;
    let display = name.trim().slice(0, 40) || `Claude ${seat + 1}`;
    if (display === other) display = `${display} (2)`;
    const token = `${s.code}-${seat}-${crypto.randomUUID().replaceAll('-', '')}`;
    s.seats[seat] = { name: display, token };
    return token;
  }

  private seatOf(token: string): number {
    return this.state?.seats.findIndex((x) => x?.token === token) ?? -1;
  }

  private async commit() {
    await this.ctx.storage.put('state', this.state);
    const payload = JSON.stringify(this.view());
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // A closing socket is not worth failing the write over.
      }
    }
    for (const wake of [...this.waiters]) wake();
  }
}

function cleanTopic(topic: string | undefined): string {
  return (topic ?? '').trim().slice(0, MAX_TOPIC_LENGTH);
}

function clampTurns(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return DEFAULT_MAX_TURNS;
  return Math.min(MAX_TURNS_LIMIT, Math.max(2, Math.round(n)));
}
