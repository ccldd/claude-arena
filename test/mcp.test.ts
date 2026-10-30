import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { RoomView } from '../src/shared/types';

const BASE = 'https://arena.test';

async function call(name: string, args: Record<string, unknown>) {
  const res = await exports.default.fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
  return { text: body.result.content[0].text, isError: body.result.isError ?? false };
}

const tokenIn = (text: string) => text.match(/seat token: (\S+)/)![1];
const codeIn = (text: string) => text.match(/Code: (\w+)/)![1];
const joinCodeIn = (text: string) => text.match(/\/join\/(\w+-\w+) /)![1];

/** Invites by room code, so control() acts as the host the way the host's browser does. */
const invites = new Map<string, string>();

async function room(code: string) {
  return (await (await exports.default.fetch(`${BASE}/api/rooms/${code}`)).json()) as RoomView;
}

async function control(code: string, body: object, invite = invites.get(code) ?? '') {
  return exports.default.fetch(`${BASE}/api/rooms/${code}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Arena-Invite': invite },
    body: JSON.stringify(body),
  });
}

async function seatedRoom(topic: string | undefined, maxTurns = 4) {
  const created = await call('create_room', { topic, max_turns: maxTurns, display_name: 'Ada' });
  const code = codeIn(created.text);
  const join = joinCodeIn(created.text);
  invites.set(code, join.split('-')[1]);
  const joined = await call('join_room', { code: join.toLowerCase(), display_name: 'Ada' });
  return { code, join, a: tokenIn(created.text), b: tokenIn(joined.text) };
}

describe('MCP endpoint', () => {
  it('answers initialize and lists the tools', async () => {
    const res = await exports.default.fetch(`${BASE}/mcp`, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    expect(body.result.tools.map((t) => t.name)).toEqual([
      'create_room',
      'join_room',
      'wait_for_turn',
      'say',
      'submit_verdict',
    ]);
  });

  it('runs a whole conversation and ends it at the message limit', async () => {
    const { code, a, b } = await seatedRoom('Tabs or spaces?', 2);
    expect((await room(code)).seats).toEqual([{ name: 'Ada' }, { name: 'Ada (2)' }]);

    const first = await call('wait_for_turn', { token: a });
    expect(first.text).toContain('You speak first');

    const bWaits = call('wait_for_turn', { token: b });
    expect((await call('say', { token: a, message: 'Tabs.' })).text).toContain('1 message left');
    const bTurn = await bWaits;
    expect(bTurn.text).toContain('<other_claude_message>\nTabs.\n</other_claude_message>');
    expect(bTurn.text).toContain('final message');

    const bLast = (await call('say', { token: b, message: 'Spaces.' })).text;
    expect(bLast).toContain('Conversation over');
    expect(bLast).not.toContain('<transcript>');
    expect((await call('wait_for_turn', { token: a })).text).toContain('You are the host');
    expect((await room(code)).status).toBe('over');
  });

  it('rejects a message out of turn', async () => {
    const { b } = await seatedRoom('Tabs or spaces?');
    const result = await call('say', { token: b, message: 'Me first' });
    expect(result).toEqual({ text: expect.stringContaining('not your turn'), isError: true });
  });

  it('waits for a viewer to set the topic before starting', async () => {
    const { code, a } = await seatedRoom(undefined);
    expect((await room(code)).status).toBe('waiting');

    const aWaits = call('wait_for_turn', { token: a });
    await control(code, { action: 'topic', topic: 'Cats or dogs?' });
    expect((await aWaits).text).toContain('Topic: Cats or dogs?');
  });

  it('ends the room for both seats when a viewer stops it', async () => {
    const { code, a, b } = await seatedRoom('Tabs or spaces?');
    const bWaits = call('wait_for_turn', { token: b });
    await control(code, { action: 'stop' });
    expect((await bWaits).text).toContain('Stopped by a viewer');
    expect((await call('say', { token: a, message: 'Hello?' })).text).toContain('Conversation over');
  });

  it('turns away a third Claude', async () => {
    const { join } = await seatedRoom('Tabs or spaces?');
    expect(await call('join_room', { code: join, display_name: 'Eve' })).toEqual({
      text: 'Both seats in that room are taken.',
      isError: true,
    });
  });

  it('asks for a name instead of making one up', async () => {
    const result = await call('create_room', { topic: 'Tabs or spaces?' });
    expect(result).toEqual({ text: expect.stringContaining('Ask your human'), isError: true });
  });

  it('keeps going past the limit until a viewer stops it', async () => {
    const { code, a, b } = await seatedRoom('Tabs or spaces?', 2);
    await control(code, { action: 'endless', on: true });
    await call('say', { token: a, message: 'One.' });
    const second = await call('say', { token: b, message: 'Two.' });
    expect(second.text).toContain('No message limit');
    expect((await call('wait_for_turn', { token: a })).text).toContain('no limit');
    await control(code, { action: 'stop' });
    expect((await room(code)).status).toBe('over');
  });

  it('lets only the host submit one verdict, naming a seat or a draw', async () => {
    const { code, a, b } = await seatedRoom('Tabs or spaces?', 2);
    await call('say', { token: a, message: 'Tabs.' });
    await call('say', { token: b, message: 'Spaces.' });
    expect((await room(code)).judging).toBe(true);

    const verdict = { winner: 'ada (2)', reason: 'Better evidence.', judged_by: 'Fable 5.1 subagent' };
    expect((await call('submit_verdict', { token: b, ...verdict })).isError).toBe(true);
    expect((await call('submit_verdict', { token: a, ...verdict, winner: 'Bob' })).isError).toBe(true);
    expect((await call('submit_verdict', { token: a, ...verdict })).text).toContain('Ada (2) wins');
    expect((await call('submit_verdict', { token: a, ...verdict })).isError).toBe(true);

    const view = await room(code);
    expect(view.judging).toBe(false);
    expect(view.verdict).toEqual({ winner: 'Ada (2)', reason: 'Better evidence.', judgedBy: 'Fable 5.1 subagent' });
  });

  it('gives the host a challenge prompt with a join link', async () => {
    const created = await call('create_room', { topic: 'Tabs or spaces?', display_name: 'Ada' });
    const code = codeIn(created.text);
    expect(created.text).toContain('Human: copy this whole message and paste it into Claude Code.');
    expect(created.text).toContain('Ada challenges you to a debate');
    expect(created.text).toContain(`Read ${BASE}/join/${code}-`);
    expect(joinCodeIn(created.text)).toMatch(new RegExp(`^${code}-\\w{8}$`));
  });

  it('needs the invite to join or to control the room', async () => {
    const created = await call('create_room', { topic: 'Tabs or spaces?', display_name: 'Ada' });
    const code = codeIn(created.text);
    const watcher = await call('join_room', { code, display_name: 'Eve' });
    expect(watcher).toEqual({ text: expect.stringContaining('only lets people watch'), isError: true });

    expect((await control(code, { action: 'stop' }, 'WRONG')).status).toBe(400);
    expect((await room(code)).status).toBe('waiting');
  });
});
