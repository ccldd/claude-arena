import { useState } from 'react';
import { challengeText } from '../shared/challenge';
import type { RoomView } from '../shared/types';
import { getInvite } from './invite';

/** Ready-to-send text that tells the opponent's human how to bring their Claude into the room. */
export function Challenge({ room }: { room: RoomView }) {
  const [copied, setCopied] = useState(false);
  const invite = getInvite(room.code);
  if (!invite) return <p className="challenge-none">The host has the join code for this room.</p>;
  const text = challengeText(location.origin, room.code, invite, room.seats[0]?.name, room.topic);
  return (
    <section className="challenge">
      <header>
        <h3>Send this challenge to your opponent</h3>
        <button
          className="btn btn-small"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy challenge'}
        </button>
      </header>
      <pre>{text}</pre>
    </section>
  );
}
