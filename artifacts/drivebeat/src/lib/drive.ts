// Use the backend proxy for all Google Drive API calls.
// The API server is routed at /api by the shared proxy.
const PROXY_BASE = "/api/drive";

export function isApiKeyConfigured(): boolean {
  // Key is stored on the server, so we can just check if the server is reachable.
  return true;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  link: string;
}

export function extractFolderId(url: string): string | null {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  // If it looks like a raw ID (no slashes, no special chars except _ and -)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) {
    return url.trim();
  }
  return null;
}

export async function fetchFolderName(folderId: string): Promise<string> {
  const url = `${PROXY_BASE}/files/${folderId}?fields=name`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("Drive proxy folder error:", res.status, body);
    throw new Error(`Failed to fetch folder info: ${res.status} ${res.statusText}|${body.error?.message || body.error?.errors?.[0]?.message || body.message || ""}`);
  }
  const data = await res.json();
  return data.name ?? "Untitled Folder";
}

export async function fetchAudioFiles(folderId: string): Promise<DriveFile[]> {
  const audioTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/aac",
    "audio/m4a",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
  ];

  const q = encodeURIComponent(
    `'${folderId}' in parents and (${audioTypes.map((t) => `mimeType='${t}'`).join(" or ")}) and trashed=false`
  );

  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime)");
  let allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : "";
    const url = `${PROXY_BASE}/files?q=${q}&fields=${fields}&orderBy=name&pageSize=1000${tokenParam}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Drive proxy list error:", res.status, body);
      throw new Error(`Drive API error: ${res.status} ${res.statusText}|${body.error?.message || body.error?.errors?.[0]?.message || body.message || ""}`);
    }
    const data = await res.json();
    allFiles = allFiles.concat(data.files ?? []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

export function getStreamUrl(fileId: string): string {
  return `${PROXY_BASE}/media/${fileId}?alt=media`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|[\s\-_]+)(\w)/g, (_, ch) => (ch ? " " + ch.toUpperCase() : ""))
    .trim();
}

export function cleanTrackName(name: string): string {
  const cleaned = name
    .replace(/\.[^/.]+$/, "")
    .replace(/^\d+[\.\-_\s]+/, "")
    .trim();
  return toTitleCase(cleaned);
}
