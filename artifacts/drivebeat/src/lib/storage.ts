import type { DriveFile, DriveFolder } from "./drive";

const FOLDERS_KEY = "drivebeat_folders";
const TRACKS_PREFIX = "drivebeat_tracks_";
const TRACK_RENAMES_PREFIX = "drivebeat_track_renames_";
const FOLDER_RENAMES_KEY = "drivebeat_folder_renames";

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
  localStorage.removeItem(TRACK_RENAMES_PREFIX + folderId);
  const renames = getFolderRenames();
  delete renames[folderId];
  localStorage.setItem(FOLDER_RENAMES_KEY, JSON.stringify(renames));
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

// --- Track rename ---

export function getTrackRenames(folderId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(TRACK_RENAMES_PREFIX + folderId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setTrackRename(folderId: string, trackId: string, name: string): void {
  const renames = getTrackRenames(folderId);
  if (name.trim()) {
    renames[trackId] = name.trim();
  } else {
    delete renames[trackId];
  }
  localStorage.setItem(TRACK_RENAMES_PREFIX + folderId, JSON.stringify(renames));
}

// --- Folder rename ---

function getFolderRenames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FOLDER_RENAMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getFolderRename(folderId: string): string | null {
  return getFolderRenames()[folderId] ?? null;
}

export function setFolderRename(folderId: string, name: string): void {
  const renames = getFolderRenames();
  if (name.trim()) {
    renames[folderId] = name.trim();
  } else {
    delete renames[folderId];
  }
  localStorage.setItem(FOLDER_RENAMES_KEY, JSON.stringify(renames));
}
