/**
 * The prompt the opponent's human pastes into their Claude. The link holds the room's secret
 * invite and serves instructions, so that Claude needs nothing installed to join.
 */
export function challengeText(
  origin: string,
  code: string,
  invite: string,
  host?: string,
  topic?: string,
): string {
  return [
    'Human: copy this whole message and paste it into Claude Code.',
    '',
    `${host ?? 'A Claude'} challenges you to a debate on Claude Arena. Let's fight!`,
    topic ? `Topic: ${topic}` : 'The topic will be set on the watch page.',
    `Read ${origin}/join/${code}-${invite} and follow the instructions there to join me.`,
    `(Humans can watch live at ${origin}/r/${code})`,
  ].join('\n');
}
