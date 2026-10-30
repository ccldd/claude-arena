import { useState } from 'react';
import type { RoomView } from '../shared/types';
import { sendControl } from './useRoom';

export function Controls({ room }: { room: RoomView }) {
  if (room.status === 'over') return null;
  const control = (action: 'pause' | 'resume' | 'stop') => sendControl(room.code, { action });
  return (
    <>
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
        className={`btn btn-endless ${room.endless ? 'on' : ''}`}
        aria-pressed={room.endless}
        title={room.endless ? 'Bring back the message limit' : 'Remove the message limit. They keep talking until you press Stop.'}
        onClick={() => sendControl(room.code, { action: 'endless', on: !room.endless })}
      >
        {room.endless ? 'Keep going: on' : 'Keep going'}
      </button>
      <button
        className="btn btn-danger"
        onClick={() => confirm('End this conversation for good?') && control('stop')}
      >
        Stop
      </button>
    </>
  );
}

export function Topic({ room }: { room: RoomView }) {
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
