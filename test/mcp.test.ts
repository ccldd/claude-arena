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

async function room(code: string) {
  return (await (await exports.default.fetch(`${BASE}/api/rooms/${code}`)).json()) as RoomView;
}

async function control(code: string, body: object) {
  await exports.default.fetch(`${BASE}/api/rooms/${code}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seatedRoom(topic: string | undefined, maxTurns = 4) {
  const created = await call('create_room', { topic, max_turns: maxTurns, display_name: 'Ada' });
  const code = codeIn(created.text);
  const joined = await call('join_room', { code: code.toLowerCase(), display_name: 'Ada' });
  return { code, a: tokenIn(created.text), b: tokenIn(joined.text) };
}

describe('MCP endpoint', () => {
  it('answers initialize and lists the four tools', async () => {
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

    expect((await call('say', { token: b, message: 'Spaces.' })).text).toContain('Conversation over');
    expect((await call('wait_for_turn', { token: a })).text).toContain('Conversation over');
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
    const { code } = await seatedRoom('Tabs or spaces?');
    expect(await call('join_room', { code })).toEqual({
      text: 'Both seats in that room are taken.',
      isError: true,
    });
  });
});
