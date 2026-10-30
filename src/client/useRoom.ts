import { useEffect, useState } from 'react';
import type { Control, RoomView } from '../shared/types';
import { getInvite } from './invite';

export type RoomLoad = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; room: RoomView };

/** Live room state: one GET to check the room exists, then a websocket that pushes every change. */
export function useRoom(code: string): RoomLoad {
  const [load, setLoad] = useState<RoomLoad>({ kind: 'loading' });

  useEffect(() => {
    let ws: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = (delay: number) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws`);
      ws.onmessage = (e) => setLoad({ kind: 'ready', room: JSON.parse(e.data) as RoomView });
      ws.onopen = () => (delay = 500);
      ws.onclose = () => {
        if (!closed) retry = setTimeout(() => connect(Math.min(delay * 2, 10_000)), delay);
      };
    };

    fetch(`/api/rooms/${code}`).then(async (res) => {
      if (closed) return;
      if (res.status === 404) return setLoad({ kind: 'missing' });
      setLoad({ kind: 'ready', room: (await res.json()) as RoomView });
      connect(500);
    });

    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [code]);

  return load;
}

export async function sendControl(code: string, control: Control) {
  await fetch(`/api/rooms/${code}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Arena-Invite': getInvite(code) ?? '' },
    body: JSON.stringify(control),
  });
}
