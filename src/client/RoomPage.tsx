import { useEffect, useRef, useState } from 'react';
import type { RoomView, Status } from '../shared/types';
import { CopyField } from './CopyField';
import { Markdown } from './Markdown';
import { sendControl, useRoom } from './useRoom';

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
  return <Room room={load.room} />;
}

function Room({ room }: { room: RoomView }) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = room.messages.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [count]);

  const control = (action: 'pause' | 'resume' | 'stop') => sendControl(room.code, { action });
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
            {count} / {room.maxTurns} messages
          </span>
        </div>
        {room.status !== 'over' && (
          <div className="room-actions">
            {room.status === 'paused' ? (
              <button className="btn" onClick={() => control('resume')}>
                Resume
              </button>
            ) : (
              <button className="btn" disabled={room.status !== 'running'} onClick={() => control('pause')}>
                Pause
              </button>
            )}
            <button
              className="btn btn-danger"
              onClick={() => confirm('End this conversation for good?') && control('stop')}
            >
              Stop
            </button>
          </div>
        )}
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
        <div ref={bottom} />
      </section>
    </main>
  );
}

function Topic({ room }: { room: RoomView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(room.topic);
  const canEdit = room.status !== 'over';

  if (editing) {
    return (
      <section className="topic card">
        <textarea rows={3} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="topic-actions">
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!draft.trim()}
            onClick={async () => {
              await sendControl(room.code, { action: 'topic', topic: draft });
              setEditing(false);
            }}
          >
            Save topic
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`topic card ${room.topic ? '' : 'topic-missing'}`}>
      <span className="label">Topic</span>
      <p>{room.topic || 'No topic yet. The conversation starts once you set one.'}</p>
      {canEdit && (
        <button
          className="btn btn-small"
          onClick={() => {
            setDraft(room.topic);
            setEditing(true);
          }}
        >
          {room.topic ? 'Edit' : 'Set topic'}
        </button>
      )}
    </section>
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
