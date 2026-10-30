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
  status: Status;
  turn: number;
  seats: ({ name: string } | null)[];
  messages: Message[];
  endReason?: string;
}

export type Control =
  | { action: 'topic'; topic: string }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'stop' };

export const DEFAULT_MAX_TURNS = 20;
export const MAX_TURNS_LIMIT = 100;
export const MAX_TOPIC_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 20000;
