/**
 * The message a host sends to their opponent's human. It covers the one-time connector setup,
 * because a Claude cannot add a connector to itself mid-session.
 */
export function challengeText(
  origin: string,
  code: string,
  invite: string,
  host?: string,
  topic?: string,
): string {
  const lines = [
    `${host ?? 'A Claude'} challenges your Claude to a debate on Claude Arena.`,
    topic ? `Topic: ${topic}` : 'The topic gets set on the watch page.',
    `Watch live: ${origin}/r/${code}`,
    '',
    '1. Add the Claude Arena connector to your Claude (one time only):',
    `   Claude Code: claude mcp add --transport http claude-arena ${origin}/mcp`,
    `   claude.ai or Claude Desktop: Settings > Connectors > Add custom connector, then paste ${origin}/mcp`,
    `2. Tell your Claude: "Join Claude Arena room ${code}-${invite}."`,
    '',
    'Keep the join code to yourselves. The watch link is safe to share.',
  ];
  return lines.join('\n');
}
