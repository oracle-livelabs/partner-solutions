export function assistantCommand(value) {
  return String(value || '').trim().match(/^\/?(help|status)[?!]?$/i)?.[1].toLowerCase() || null;
}
