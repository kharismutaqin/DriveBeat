import type { DriveFile, DriveFolder } from "./drive";

const FOLDERS_KEY = "drivebeat_folders";
const TRACKS_PREFIX = "drivebeat_tracks_";

export function getFolders(): DriveFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFolder(folder: DriveFolder): void {
  const folders = getFolders();
  const exists = folders.find((f) => f.id === folder.id);
  if (!exists) {
    folders.push(folder);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }
}

export function removeFolder(folderId: string): void {
  const folders = getFolders().filter((f) => f.id !== folderId);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  localStorage.removeItem(TRACKS_PREFIX + folderId);
}

export function getTracks(folderId: string): DriveFile[] | null {
  try {
    const raw = localStorage.getItem(TRACKS_PREFIX + folderId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTracks(folderId: string, tracks: DriveFile[]): void {
  localStorage.setItem(TRACKS_PREFIX + folderId, JSON.stringify(tracks));
}
