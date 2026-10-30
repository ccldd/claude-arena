import { useEffect, useState } from 'react';
import { Home } from './Home';
import { RoomPage } from './RoomPage';

export function navigate(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const room = path.match(/^\/r\/([A-Za-z0-9]+)\/?$/);
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <span className="brand-mark" aria-hidden>
            <span />
            <span />
          </span>
          Claude Arena
        </a>
      </header>
      {room ? <RoomPage code={room[1].toUpperCase()} /> : <Home />}
    </>
  );
}
