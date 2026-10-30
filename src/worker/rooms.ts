import type { CreateOptions } from './room';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const INVITE_LENGTH = 8;

export function roomStub(env: Env, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(normaliseCode(code)));
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** A join code is the room code plus the room's secret invite, like ABC123-7KQ2M9XA. */
export function splitJoinCode(joinCode: string): { code: string; invite: string } {
  const [code = '', invite = ''] = normaliseCode(joinCode).split('-');
  return { code, invite };
}

/** Seat tokens start with the room code, so a token alone finds its room. */
export function codeFromToken(token: string): string {
  return token.split('-')[0] ?? '';
}

export async function createRoom(env: Env, opts: Omit<CreateOptions, 'code' | 'invite'>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(CODE_LENGTH);
    const invite = randomCode(INVITE_LENGTH);
    const result = await roomStub(env, code).create({ ...opts, code, invite });
    if (result.ok) return { code, invite, token: result.token };
  }
  throw new Error('Could not find a free room code');
}

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
