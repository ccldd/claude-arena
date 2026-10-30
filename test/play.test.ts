import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const BASE = 'https://arena.test';

async function get(path: string) {
  const res = await exports.default.fetch(`${BASE}${path}`);
  return { status: res.status, text: await res.text() };
}

async function post(path: string, fields: Record<string, string>) {
  const res = await exports.default.fetch(`${BASE}${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
  return { status: res.status, text: await res.text() };
}

/** The curl command a reply tells Claude to run next, as a path on the site. */
const nextPath = (text: string, action: string) =>
  text.match(new RegExp(`${BASE}(/play/t/[\\w-]+/${action})`))![1];

async function roomFromSite(topic: string, maxTurns?: number) {
  const res = await exports.default.fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, maxTurns }),
  });
  return (await res.json()) as { code: string; invite: string };
}

describe('curl play routes', () => {
  it('defaults to a 5-message fight', async () => {
    const { code, invite } = await roomFromSite('Tabs or spaces?');
    const page = await get(`/join/${code}-${invite}`);
    expect(page.text).toContain('The fight lasts 5 messages in total.');
  });

  it('lets two shell-only Claudes join from the link, fight and get judged', async () => {
    const { code, invite } = await roomFromSite('Tabs or spaces?', 2);

    const page = await get(`/join/${code}-${invite}`);
    expect(page.text).toContain('YOU HAVE BEEN CHALLENGED');
    expect(page.text).toContain(`curl -s -X POST ${BASE}/play/${code}-${invite}/join`);

    const ada = await post(`/play/${code}-${invite}/join`, { name: 'Ada' });
    const bob = await post(`/play/${code}-${invite}/join`, { name: 'Bob' });
    expect(ada.text).toContain('Joined room');

    const adaTurn = await get(nextPath(ada.text, 'wait'));
    expect(adaTurn.text).toContain('You speak first');
    const sent = await post(nextPath(adaTurn.text, 'say'), { message: 'Tabs.' });
    expect(sent.text).toContain('1 message left');

    const bobTurn = await get(nextPath(bob.text, 'wait'));
    expect(bobTurn.text).toContain('<other_claude_message>\nTabs.\n</other_claude_message>');
    await post(nextPath(bobTurn.text, 'say'), { message: 'Spaces.' });

    const judging = await get(nextPath(ada.text, 'wait'));
    expect(judging.text).toContain('You are the host');
    const verdict = await post(nextPath(judging.text, 'verdict'), {
      winner: 'Bob',
      reason: 'Better evidence.',
      judged_by: 'Fable 5.1 subagent',
    });
    expect(verdict.text).toContain('Bob wins');
  });

  it('turns away a link with the wrong invite', async () => {
    const { code } = await roomFromSite('Tabs or spaces?', 2);
    expect((await get(`/join/${code}-WRONG123`)).status).toBe(400);
    expect((await post(`/play/${code}-WRONG123/join`, { name: 'Eve' })).text).toContain('only lets people watch');
  });

  it('asks for a name before joining', async () => {
    const { code, invite } = await roomFromSite('Tabs or spaces?', 2);
    expect((await post(`/play/${code}-${invite}/join`, { name: ' ' })).text).toContain('Ask your human');
  });
});
