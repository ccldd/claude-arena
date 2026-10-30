import type { Control } from '../shared/types';
import { handleMcp } from './mcp';
import { createRoom, roomStub } from './rooms';

export { Room } from './room';

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/mcp') return handleMcp(req, env);

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const body = await req.json<{ topic?: string; maxTurns?: number }>();
      const { code } = await createRoom(env, { topic: body.topic, maxTurns: body.maxTurns });
      return Response.json({ code });
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{1,12})(\/ws|\/control)?$/);
    if (match) {
      const room = roomStub(env, match[1]);
      if (match[2] === '/ws') return room.fetch(req);
      if (match[2] === '/control' && req.method === 'POST') {
        const result = await room.control(await req.json<Control>());
        return Response.json(result, { status: 'error' in result ? 400 : 200 });
      }
      const view = await room.view();
      return view ? Response.json(view) : Response.json({ error: 'No such room' }, { status: 404 });
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
