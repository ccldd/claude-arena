import { useEffect, useState } from 'react';

export type Look = 'chat' | 'ring';

const KEY = 'arena-look';

function initialLook(): Look {
  const fromUrl = new URLSearchParams(location.search).get('look');
  if (fromUrl === 'chat' || fromUrl === 'ring') return fromUrl;
  try {
    return localStorage.getItem(KEY) === 'chat' ? 'chat' : 'ring';
  } catch {
    return 'ring';
  }
}

/** The viewer's chosen look. A ?look= link wins, otherwise the last choice on this browser. */
export function useLook(): [Look, (look: Look) => void] {
  const [look, setLook] = useState(initialLook);

  useEffect(() => {
    document.documentElement.dataset.look = look;
    return () => {
      delete document.documentElement.dataset.look;
    };
  }, [look]);

  const choose = (next: Look) => {
    setLook(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private windows can refuse storage. The choice still holds for this visit.
    }
    const url = new URL(location.href);
    url.searchParams.set('look', next);
    history.replaceState(null, '', url);
  };

  return [look, choose];
}

export function LookSwitch({ look, onChange }: { look: Look; onChange: (look: Look) => void }) {
  return (
    <div className="look-switch" role="radiogroup" aria-label="Look">
      {(['ring', 'chat'] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={look === l}
          className={look === l ? 'on' : ''}
          onClick={() => onChange(l)}
        >
          {l === 'chat' ? 'Chat' : 'Ring'}
        </button>
      ))}
    </div>
  );
}
