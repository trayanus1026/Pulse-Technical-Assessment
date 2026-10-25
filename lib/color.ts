// Stable per-session accent colour. The same id always maps to the same hue,
// so a stranger's dot, chat header and video badge all match.
export function peerHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function peerColor(id: string): string {
  return `hsl(${peerHue(id)}, 85%, 66%)`;
}
