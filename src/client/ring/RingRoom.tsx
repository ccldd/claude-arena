import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Message, RoomView } from '../../shared/types';
import { Markdown } from '../Markdown';
import { Controls, Topic } from '../RoomControls';
import { Boxer, type BoxerState } from './Boxer';
import { Crowd } from './Crowd';
import { setSound, sfx, soundOn } from './sound';
import './ring.css';

const HIT_MS = 900;
const SOUNDS = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!', 'THWACK!', 'BOOM!'];

export function RingRoom({ room, switcher }: { room: RoomView; switcher: ReactNode }) {
  const count = room.messages.length;
  const latest = room.messages.at(-1);

  // Only messages that arrive while the page is open get a punch and the typewriter.
  const seenOnLoad = useRef(count);
  const [hit, setHit] = useState<{ seat: number; n: number } | null>(null);
  useEffect(() => {
    if (count <= seenOnLoad.current || !latest) return;
    setHit({ seat: latest.seat, n: count });
    sfx.punch();
    const timer = setTimeout(() => setHit(null), HIT_MS);
    return () => clearTimeout(timer);
  }, [count]);

  useMatchSounds(room);

  const stateOf = (seat: number): BoxerState => {
    if (!room.seats[seat]) return 'empty';
    if (hit) return hit.seat === seat ? 'punch' : 'hurt';
    const winner = room.verdict?.winner;
    if (winner) return room.seats[seat]?.name === winner ? 'win' : 'ko';
    if (room.status === 'over') return 'rest';
    if (room.status === 'running' && room.turn === seat) return 'windup';
    return 'idle';
  };

  return (
    <main className="ring-page">
      <section className="ring-bar">
        <span className="ring-code">
          ROOM <b>{room.code}</b>
        </span>
        <div className="ring-actions">
          {switcher}
          <SoundSwitch />
          <Controls room={room} />
        </div>
      </section>

      <Hud room={room} />

      <div className="ring-card">
        <Topic room={room} />
      </div>

      <section className={`scene ${hit ? 'shake' : ''}`}>
        <Crowd />
        <div className="spot" />
        <div className="post post-l" />
        <div className="post post-r" />
        <div className="rope rope-1" />
        <div className="rope rope-2" />
        <div className="rope rope-3" />
        <div className="floor" />
        <Boxer seat={0} state={stateOf(0)} />
        <Boxer seat={1} state={stateOf(1)} />
        <div className="rope rope-front" />
        <div className="apron">CLAUDE ARENA</div>
        {hit && (
          <div key={hit.n} className={`pow pow-${hit.seat}`}>
            {SOUNDS[hit.n % SOUNDS.length]}
          </div>
        )}
        <Banner room={room} />
      </section>

      {room.verdict && (
        <section className="dialogue judge">
          <span className="dialogue-name">JUDGE: {room.verdict.judgedBy}</span>
          <p className="dialogue-text">{room.verdict.reason}</p>
        </section>
      )}
      <Dialogue room={room} latest={latest} animate={count > seenOnLoad.current} />

      {count > 1 && (
        <section className="log">
          <h2>FIGHT LOG</h2>
          {room.messages.slice(0, -1).map((m, i) => (
            <article key={i} className={`log-entry seat-${m.seat}`}>
              <header>
                <span>R{i + 1}</span> {m.name}
              </header>
              <Markdown text={m.text} />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

/** Bells and the verdict fanfare, played only for changes seen while the page is open. */
function useMatchSounds(room: RoomView) {
  const prev = useRef({ status: room.status, verdict: !!room.verdict });
  useEffect(() => {
    const was = prev.current;
    if (was.status !== 'running' && room.status === 'running' && room.messages.length === 0) sfx.bell();
    if (was.status !== 'over' && room.status === 'over') sfx.bell(3);
    if (!was.verdict && room.verdict) {
      sfx.fanfare();
      if (room.verdict.winner) sfx.knockout();
    }
    prev.current = { status: room.status, verdict: !!room.verdict };
  }, [room.status, room.verdict, room.messages.length]);
}

function SoundSwitch() {
  const [on, setOn] = useState(soundOn);
  return (
    <button
      className={`btn btn-sound ${on ? 'on' : ''}`}
      aria-pressed={on}
      onClick={() => {
        setSound(!on);
        setOn(!on);
        if (!on) sfx.bell();
      }}
    >
      {on ? 'SOUND: ON' : 'SOUND: OFF'}
    </button>
  );
}

function Hud({ room }: { room: RoomView }) {
  // Each punch knocks the other boxer down a notch. Nobody quite hits zero.
  const perHit = 90 / Math.ceil(Math.max(room.maxTurns, room.messages.length) / 2);
  const health = (seat: number) =>
    Math.max(10, 100 - room.messages.filter((m) => m.seat !== seat).length * perHit);

  return (
    <section className="hud">
      {[0, 1].map((seat) => (
        <div key={seat} className={`hud-side seat-${seat}`}>
          <span className="hud-name">{room.seats[seat]?.name ?? '???'}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${health(seat)}%` }} />
          </div>
        </div>
      ))}
      <div className="hud-round">
        <small>ROUND</small>
        <b>
          {room.endless
            ? `${room.messages.length + 1}/∞`
            : `${Math.min(room.messages.length + 1, room.maxTurns)}/${room.maxTurns}`}
        </b>
      </div>
    </section>
  );
}

function Banner({ room }: { room: RoomView }) {
  let text: string | null = null;
  if (room.verdict) text = room.verdict.winner ? `${room.verdict.winner} WINS!` : 'DRAW!';
  else if (room.judging) text = 'JUDGES SCORING...';
  else if (room.status === 'over') text = 'FINAL BELL';
  else if (room.status === 'paused') text = 'TIME OUT';
  else if (room.seats.some((s) => !s)) text = 'WAITING FOR A CHALLENGER';
  else if (!room.topic) text = 'SET THE FIGHT CARD';
  else if (room.messages.length === 0) text = 'FIGHT!';
  return text ? <div className={`banner ${text === 'FIGHT!' ? 'banner-fight' : ''}`}>{text}</div> : null;
}

function Dialogue({ room, latest, animate }: { room: RoomView; latest?: Message; animate: boolean }) {
  const text = latest ? plain(latest.text) : '';
  const [shown, done, skip] = useTypewriter(text, animate);
  const speaker = room.seats[room.turn];

  if (!latest) {
    return (
      <section className="dialogue">
        <p className="dialogue-text">
          {room.status === 'running' && speaker ? `${speaker.name} steps up...` : 'The crowd is waiting.'}
        </p>
      </section>
    );
  }

  return (
    <section className={`dialogue seat-${latest.seat}`} onClick={skip} title="Click to skip">
      <span className="dialogue-name">{latest.name}</span>
      <p className="dialogue-text">
        {shown}
        {done && <span className="caret">▼</span>}
      </p>
      {done && room.status === 'running' && speaker && (
        <p className="dialogue-next">{speaker.name} is winding up a reply...</p>
      )}
      {room.status === 'over' && <p className="dialogue-next">{room.endReason}</p>}
    </section>
  );
}

function useTypewriter(text: string, animate: boolean): [string, boolean, () => void] {
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return setN(text.length);
    setN(0);
    // Long messages type faster so none takes more than about ten seconds.
    const step = Math.max(1, Math.ceil(text.length / 600));
    let ticks = 0;
    const timer = setInterval(() => {
      if (ticks++ % 4 === 0) sfx.blip();
      setN((v) => {
        if (v >= text.length) clearInterval(timer);
        return Math.min(text.length, v + step);
      });
    }, 16);
    return () => clearInterval(timer);
  }, [text, animate]);
  return [text.slice(0, n), n >= text.length, () => setN(text.length)];
}

function plain(markdown: string): string {
  return markdown
    .replace(/```\w*\n?/g, '')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\W)[*_]([^*_\n]+)[*_]/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1');
}
