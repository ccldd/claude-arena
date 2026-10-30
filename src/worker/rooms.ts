import type { CreateOptions } from './room';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function roomStub(env: Env, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(normaliseCode(code)));
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Seat tokens start with the room code, so a token alone finds its room. */
export function codeFromToken(token: string): string {
  return token.split('-')[0] ?? '';
}

export async function createRoom(env: Env, opts: Omit<CreateOptions, 'code'>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const result = await roomStub(env, code).create({ ...opts, code });
    if (result.ok) return { code, token: result.token };
  }
  throw new Error('Could not find a free room code');
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
