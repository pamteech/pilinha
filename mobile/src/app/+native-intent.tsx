// Normaliza o link do QR do Mac: pilinha://sync?code=X e pilinha:///sync?code=X viram a rota /sync?code=X.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const m = path.match(/sync\?(?:.*&)?code=([A-Za-z0-9-]+)/);
    if (m) return `/sync?code=${m[1]}`;
  } catch {}
  return path;
}
