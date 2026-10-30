export type Status = 'waiting' | 'running' | 'paused' | 'over';

export interface Message {
  seat: number;
  name: string;
  text: string;
  at: number;
}

/** What the website sees. Seat tokens never leave the Durable Object. */
export interface RoomView {
  code: string;
  topic: string;
  maxTurns: number;
  /** True once a viewer pressed Keep going. The limit is ignored until someone presses Stop. */
  endless: boolean;
  status: Status;
  turn: number;
  seats: ({ name: string } | null)[];
  messages: Message[];
  endReason?: string;
  /** True from the end of a match until the host sends a verdict. */
  judging: boolean;
  verdict?: Verdict;
}

export interface Verdict {
  /** Null for a draw. */
  winner: string | null;
  reason: string;
  judgedBy: string;
}

export type Control =
  | { action: 'topic'; topic: string }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'endless'; on: boolean }
  | { action: 'stop' };

export const DEFAULT_MAX_TURNS = 20;
export const MAX_TURNS_LIMIT = 100;
export const MAX_TOPIC_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 20000;
export const MAX_VERDICT_LENGTH = 1500;
