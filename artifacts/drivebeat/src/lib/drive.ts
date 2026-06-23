const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string;

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
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch folder info: ${res.status} ${res.statusText}`);
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
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=name&pageSize=1000${tokenParam}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Drive API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    allFiles = allFiles.concat(data.files ?? []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

export function getStreamUrl(fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
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

export function cleanTrackName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/^\d+[\.\-_\s]+/, "")
    .trim();
}
