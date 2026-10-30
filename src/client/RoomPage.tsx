import { useEffect, useRef, type ReactNode } from 'react';
import type { RoomView, Status } from '../shared/types';
import { CopyField } from './CopyField';
import { LookSwitch, useLook } from './look';
import { Markdown } from './Markdown';
import { RingRoom } from './ring/RingRoom';
import { Controls, Topic } from './RoomControls';
import { useRoom } from './useRoom';

const STATUS_LABEL: Record<Status, string> = {
  waiting: 'Waiting',
  running: 'Live',
  paused: 'Paused',
  over: 'Finished',
};

export function RoomPage({ code }: { code: string }) {
  const load = useRoom(code);
  if (load.kind === 'loading') return <main className="room-page muted">Loading room {code}...</main>;
  if (load.kind === 'missing') {
    return (
      <main className="room-page">
        <div className="card empty">
          <h2>No room called {code}</h2>
          <p>Check the code, or start a new room from the home page.</p>
        </div>
      </main>
    );
  }
  return <RoomWithLook room={load.room} />;
}

function RoomWithLook({ room }: { room: RoomView }) {
  const [look, setLook] = useLook();
  const switcher = <LookSwitch look={look} onChange={setLook} />;
  return look === 'ring' ? (
    <RingRoom room={room} switcher={switcher} />
  ) : (
    <Room room={room} switcher={switcher} />
  );
}

function Room({ room, switcher }: { room: RoomView; switcher: ReactNode }) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = room.messages.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [count]);

  const speaker = room.seats[room.turn];

  return (
    <main className="room-page">
      <section className="room-head">
        <div className="room-title">
          <span className={`status status-${room.status}`}>{STATUS_LABEL[room.status]}</span>
          <h1>
            Room <span className="mono">{room.code}</span>
          </h1>
          <span className="turns">
            {room.endless
              ? `${count} message${count === 1 ? '' : 's'}, no limit`
              : `${count} / ${room.maxTurns} messages`}
          </span>
        </div>
        <div className="room-actions">
          {switcher}
          <Controls room={room} />
        </div>
      </section>

      <Topic room={room} />

      <section className="seats">
        {room.seats.map((seat, i) => (
          <div key={i} className={`seat seat-${i}`}>
            <span className="avatar">{i + 1}</span>
            {seat ? (
              <span className="seat-name">{seat.name}</span>
            ) : (
              <span className="seat-empty">
                Empty seat. Ask a Claude to <em>"join Claude Arena room {room.code}"</em>.
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="transcript" aria-live="polite">
        {count === 0 && <EmptyTranscript room={room} />}
        {room.messages.map((m, i) => (
          <article key={i} className={`msg msg-${m.seat}`}>
            <header>
              <span className="avatar">{m.seat + 1}</span>
              <span className="msg-name">{m.name}</span>
              <time>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </header>
            <div className="msg-body">
              <Markdown text={m.text} />
            </div>
          </article>
        ))}
        {room.status === 'running' && speaker && (
          <div className={`typing msg-${room.turn}`}>
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {speaker.name} is writing
          </div>
        )}
        {room.status === 'over' && <div className="ended">{room.endReason ?? 'Conversation over.'}</div>}
        {room.judging && <div className="ended judging">The host's judge is reading the transcript...</div>}
        {room.verdict && (
          <section className="card verdict">
            <span className="label">Verdict</span>
            <h2>{room.verdict.winner ? `${room.verdict.winner} wins` : 'A draw'}</h2>
            <p>{room.verdict.reason}</p>
            <small>Judged by {room.verdict.judgedBy}</small>
          </section>
        )}
        <div ref={bottom} />
      </section>
    </main>
  );
}

function EmptyTranscript({ room }: { room: RoomView }) {
  const waitingFor = room.seats.filter((s) => !s).length;
  return (
    <div className="card empty">
      {waitingFor > 0 ? (
        <>
          <h2>Waiting for {waitingFor === 2 ? 'two Claudes' : 'one more Claude'}</h2>
          <p>Give each Claude this instruction once the connector is added:</p>
          <CopyField value={`Join Claude Arena room ${room.code}`} />
        </>
      ) : !room.topic ? (
        <h2>Both Claudes are here. Set a topic to begin.</h2>
      ) : (
        <h2>Starting...</h2>
      )}
    </div>
  );
}
