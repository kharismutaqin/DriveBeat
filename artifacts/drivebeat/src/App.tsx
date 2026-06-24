import { useReducer, useEffect, useCallback } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { FolderModal } from "./components/FolderModal";
import { TrackList } from "./components/TrackList";
import { MiniPlayer } from "./components/MiniPlayer";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { getFolders, getTracks, saveTracks, removeFolder } from "./lib/storage";
import { fetchAudioFiles } from "./lib/drive";
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
      if (allFolders.length > 0 && state.activeFolderIndex >= allFolders.length) {
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
  const { folders, activeFolderIndex, tracks, isLoadingTracks, showFolderModal, showFolderPicker } = state;

  const activeFolder = folders[activeFolderIndex] ?? null;
  const { state: playerState, controls: playerControls } = useAudioPlayer(tracks);

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

  // After folder added, sync active folder index to the new one
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
        <header className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.05]">
          {folders.length === 1 ? (
            <h1 className="text-white/75 text-sm font-medium truncate max-w-[80%]" data-testid="text-folder-name">
              {activeFolder?.name ?? "DriveBeat"}
            </h1>
          ) : (
            <button
              onClick={() => setShowFolderPicker(!showFolderPicker)}
              className="flex items-center gap-1.5 text-white/75 text-sm font-medium max-w-[80%] hover:text-white/90 transition-colors"
              data-testid="button-folder-picker"
            >
              <span className="truncate">{activeFolder?.name ?? "DriveBeat"}</span>
              <ChevronDown
                size={13}
                className={`shrink-0 text-white/30 transition-transform ${showFolderPicker ? "rotate-180" : ""}`}
              />
            </button>
          )}

          <button
            onClick={() => { setShowFolderModal(true); setShowFolderPicker(false); }}
            data-testid="button-add-folder"
            className="text-white/35 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/6"
            title="Add new folder"
          >
            <Plus size={18} />
          </button>
        </header>
      )}

      {/* Folder picker dropdown */}
      {showFolderPicker && folders.length > 1 && (
        <div className="shrink-0 border-b border-white/[0.05] bg-[#060606]">
          {folders.map((folder, index) => (
            <div
              key={folder.id}
              className="flex items-center group"
            >
              <button
                onClick={() => handleSelectFolder(index)}
                data-testid={`button-folder-${folder.id}`}
                className={`flex-1 text-left px-4 py-3 text-sm transition-colors ${
                  index === activeFolderIndex ? "text-white/90" : "text-white/40 hover:text-white/70"
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
