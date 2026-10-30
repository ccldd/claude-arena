// The room invite is the host's secret: it lets this browser show the challenge and use the controls.
// It arrives in the host link (?invite=) or from creating the room here, and is kept per room.

const key = (code: string) => `arena-invite-${code}`;

export function storeInvite(code: string, invite: string) {
  try {
    localStorage.setItem(key(code), invite);
  } catch {
    // Without storage the host link still works for this visit, through the URL.
  }
}

export function getInvite(code: string): string | null {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get('invite')?.toUpperCase();
  if (fromUrl) {
    storeInvite(code, fromUrl);
    // Drop it from the address bar so a copied URL is only a watch link.
    url.searchParams.delete('invite');
    history.replaceState(null, '', url);
    return fromUrl;
  }
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}
