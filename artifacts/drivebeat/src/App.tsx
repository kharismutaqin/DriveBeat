import { useReducer, useEffect, useCallback, useState, useRef } from "react";
import { ChevronDown, FolderOpen, X, Loader2, Plus } from "lucide-react";
import { FolderModal } from "./components/FolderModal";
import { TrackList } from "./components/TrackList";
import { MiniPlayer } from "./components/MiniPlayer";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { getFolders, getTracks, saveTracks, removeFolder } from "./lib/storage";
import {
  fetchAudioFiles,
  extractFolderId,
  fetchFolderName,
  isApiKeyConfigured,
} from "./lib/drive";
import { saveFolder } from "./lib/storage";
import type { DriveFile, DriveFolder } from "./lib/drive";

interface AppState {
  folders: DriveFolder[];
  activeFolderIndex: number;
  tracks: DriveFile[];
  isLoadingTracks: boolean;
  showFolderModal: boolean;
  showFolderPicker: boolean;
}

type AppAction =
  | { type: "setFolders"; folders: DriveFolder[] }
  | { type: "setActiveFolderIndex"; index: number }
  | { type: "setTracks"; tracks: DriveFile[] }
  | { type: "setLoading"; loading: boolean }
  | { type: "setShowFolderModal"; show: boolean }
  | { type: "setShowFolderPicker"; show: boolean }
  | { type: "folderAdded"; folder: DriveFolder }
  | { type: "syncActiveIndex" }
  | { type: "removeFolder"; index: number };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setFolders":
      return { ...state, folders: action.folders };
    case "setActiveFolderIndex":
      return { ...state, activeFolderIndex: action.index };
    case "setTracks":
      return { ...state, tracks: action.tracks };
    case "setLoading":
      return { ...state, isLoadingTracks: action.loading };
    case "setShowFolderModal":
      return { ...state, showFolderModal: action.show };
    case "setShowFolderPicker":
      return { ...state, showFolderPicker: action.show };
    case "folderAdded": {
      const updated = state.folders.find((f) => f.id === action.folder.id)
        ? state.folders
        : [...state.folders, action.folder];
      const idx = getFolders().findIndex((f) => f.id === action.folder.id);
      return {
        ...state,
        folders: updated,
        activeFolderIndex: idx >= 0 ? idx : state.activeFolderIndex,
        showFolderModal: false,
      };
    }
    case "syncActiveIndex": {
      const allFolders = getFolders();
      if (
        allFolders.length > 0 &&
        state.activeFolderIndex >= allFolders.length
      ) {
        return { ...state, activeFolderIndex: allFolders.length - 1 };
      }
      return state;
    }
    case "removeFolder": {
      const folder = state.folders[action.index];
      if (!folder) return state;
      removeFolder(folder.id);
      const updated = getFolders();
      const newIndex =
        state.activeFolderIndex >= updated.length
          ? Math.max(0, updated.length - 1)
          : state.activeFolderIndex;
      return {
        ...state,
        folders: updated,
        activeFolderIndex: newIndex,
        showFolderPicker: false,
      };
    }
    default:
      return state;
  }
}

const initialState: AppState = {
  folders: getFolders(),
  activeFolderIndex: 0,
  tracks: [],
  isLoadingTracks: false,
  showFolderModal: false,
  showFolderPicker: false,
};

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const {
    folders,
    activeFolderIndex,
    tracks,
    isLoadingTracks,
    showFolderModal,
    showFolderPicker,
  } = state;

  const activeFolder = folders[activeFolderIndex] ?? null;
  const { state: playerState, controls: playerControls } =
    useAudioPlayer(tracks);

  // Inline add folder state (for returning users)
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineLink, setInlineLink] = useState("");
  const [inlineStatus, setInlineStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const inlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInlineAdd) {
      setInlineLink("");
      setInlineStatus("idle");
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    }
  }, [showInlineAdd]);

  const handleInlineSubmit = async () => {
    const trimmed = inlineLink.trim();
    if (!trimmed) return;

    if (!isApiKeyConfigured()) {
      setInlineStatus("error");
      return;
    }

    const folderId = extractFolderId(trimmed);
    if (!folderId) {
      setInlineStatus("error");
      return;
    }

    setInlineStatus("loading");

    try {
      const [name, files] = await Promise.all([
        fetchFolderName(folderId),
        fetchAudioFiles(folderId),
      ]);

      if (files.length === 0) {
        setInlineStatus("error");
        return;
      }

      const folder: DriveFolder = { id: folderId, name, link: trimmed };
      saveFolder(folder);
      saveTracks(folderId, files);
      handleFolderAdded(folder);
      setShowInlineAdd(false);
    } catch {
      setInlineStatus("error");
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleInlineSubmit();
    if (e.key === "Escape") setShowInlineAdd(false);
  };

  // Load tracks for active folder
  useEffect(() => {
    if (!activeFolder) {
      dispatch({ type: "setTracks", tracks: [] });
      return;
    }
    const cached = getTracks(activeFolder.id);
    if (cached) {
      dispatch({ type: "setTracks", tracks: cached });
    } else {
      dispatch({ type: "setLoading", loading: true });
      fetchAudioFiles(activeFolder.id)
        .then((files) => {
          saveTracks(activeFolder.id, files);
          dispatch({ type: "setTracks", tracks: files });
        })
        .catch(() => dispatch({ type: "setTracks", tracks: [] }))
        .finally(() => dispatch({ type: "setLoading", loading: false }));
    }
  }, [activeFolder?.id]);

  const handleFolderAdded = useCallback((folder: DriveFolder) => {
    dispatch({ type: "folderAdded", folder });
  }, []);

  useEffect(() => {
    dispatch({ type: "syncActiveIndex" });
  }, [folders]);

  const handleSelectFolder = (index: number) => {
    dispatch({ type: "setActiveFolderIndex", index });
    dispatch({ type: "setShowFolderPicker", show: false });
    playerControls.stop();
  };

  const handleRemoveFolder = (index: number) => {
    dispatch({ type: "removeFolder", index });
    playerControls.stop();
  };

  const setShowFolderModal = (show: boolean) => {
    dispatch({ type: "setShowFolderModal", show });
  };

  const setShowFolderPicker = (show: boolean) => {
    dispatch({ type: "setShowFolderPicker", show });
  };

  const hasNoFolders = folders.length === 0;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* New user: show full-screen folder modal */}
      {(hasNoFolders || showFolderModal) && (
        <FolderModal
          onFolderAdded={handleFolderAdded}
          onClose={() => setShowFolderModal(false)}
          canClose={!hasNoFolders}
        />
      )}

      {/* Header */}
      {!hasNoFolders && (
        <header className="shrink-0 border-b border-white/[0.05]">
          {/* Normal header row — always visible */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            {folders.length === 1 ? (
              <h1
                className="text-white/75 text-sm font-medium truncate max-w-[80%]"
                data-testid="text-folder-name"
              >
                {activeFolder?.name ?? "DriveBeat"}
              </h1>
            ) : (
              <button
                onClick={() => setShowFolderPicker(!showFolderPicker)}
                className="flex items-center gap-1.5 text-white/75 text-sm font-medium max-w-[80%] hover:text-white/90 transition-colors"
                data-testid="button-folder-picker"
              >
                <span className="truncate">
                  {activeFolder?.name ?? "DriveBeat"}
                </span>
                <ChevronDown
                  size={13}
                  className={`shrink-0 text-white/30 transition-transform ${showFolderPicker ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {/* Toggle button: Plus rotates 45deg to become X */}
            <button
              onClick={() => {
                setShowInlineAdd(!showInlineAdd);
                setShowFolderPicker(false);
              }}
              data-testid="button-add-folder"
              className="text-white/30 hover:text-white/65 transition-colors p-1.5 rounded-lg hover:bg-white/6"
              title={showInlineAdd ? "Close" : "Add new folder"}
            >
              <Plus
                size={17}
                className={`transition-transform duration-300 ${showInlineAdd ? "rotate-45" : "rotate-0"}`}
              />
            </button>
          </div>

          {/* Inline add folder panel — appears below header row */}
          {showInlineAdd && (
            <div className="flex items-center gap-2 px-2 pt-1 pb-3 popup-slide-up">
              <div
                className={`flex-1 flex items-center bg-white/6 rounded-xl px-3 h-10 transition-colors ${
                  inlineStatus === "error"
                    ? "ring-1 ring-red-500/40"
                    : "focus-within:ring-1 focus-within:ring-white/20"
                }`}
              >
                <input
                  ref={inlineInputRef}
                  type="url"
                  value={inlineLink}
                  onChange={(e) => {
                    setInlineLink(e.target.value);
                    setInlineStatus("idle");
                  }}
                  onKeyDown={handleInlineKeyDown}
                  placeholder="Paste here..."
                  disabled={inlineStatus === "loading"}
                  className="flex-1 bg-transparent text-white/75 text-sm placeholder:text-white/25 outline-none min-w-0"
                  data-testid="input-inline-folder-link"
                />
              </div>

              <button
                onClick={handleInlineSubmit}
                disabled={inlineStatus === "loading" || !inlineLink.trim()}
                data-testid="button-inline-load-folder"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white/60
                  hover:bg-white/15 hover:text-white/90 transition-colors
                  disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                {inlineStatus === "loading" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FolderOpen size={16} />
                )}
              </button>
            </div>
          )}
        </header>
      )}

      {/* Folder picker dropdown */}
      {showFolderPicker && folders.length > 1 && (
        <div className="shrink-0 border-b border-white/[0.05] bg-[#060606]">
          {folders.map((folder, index) => (
            <div key={folder.id} className="flex items-center group">
              <button
                onClick={() => handleSelectFolder(index)}
                data-testid={`button-folder-${folder.id}`}
                className={`flex-1 text-left px-4 py-3 text-sm transition-colors ${
                  index === activeFolderIndex
                    ? "text-white/90"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {folder.name}
              </button>
              <button
                onClick={() => handleRemoveFolder(index)}
                data-testid={`button-remove-folder-${folder.id}`}
                className="px-4 py-3 text-white/15 hover:text-red-400/60 transition-colors opacity-0 group-hover:opacity-100 text-xs"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Track list */}
      {!hasNoFolders && (
        <TrackList
          tracks={tracks}
          currentTrackId={playerState.currentTrack?.id ?? null}
          isPlaying={playerState.isPlaying}
          isLoadingTracks={isLoadingTracks}
          onSelectTrack={(track, index) => playerControls.play(track, index)}
        />
      )}

      {/* Error toast */}
      {playerState.error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-950/80 border border-red-500/20 text-red-300/80 text-xs px-4 py-3 rounded-xl backdrop-blur-sm">
          {playerState.error}
        </div>
      )}

      {/* Mini player */}
      <MiniPlayer state={playerState} controls={playerControls} />
    </div>
  );
}
