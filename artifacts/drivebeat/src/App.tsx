import { useReducer, useEffect, useCallback, useState, useRef } from "react";
import {
  ChevronDown,
  FolderOpen,
  Loader2,
  Pencil,
  Check,
  X,
  Menu,
  ChevronUp,
} from "lucide-react";
import { FolderModal } from "./components/FolderModal";
import { TrackList } from "./components/TrackList";
import { MiniPlayer } from "./components/MiniPlayer";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import {
  getFolders,
  getTracks,
  saveTracks,
  removeFolder,
  saveFolder,
  saveFolderOrder,
  getTrackRenames,
  setTrackRename,
  getFolderRename,
  setFolderRename,
} from "./lib/storage";
import {
  fetchAudioFiles,
  extractFolderId,
  fetchFolderName,
  isApiKeyConfigured,
} from "./lib/drive";
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

  // ── Manage mode ─────────────────────────────────────────────────
  const [isManageMode, setIsManageMode] = useState(false);

  const exitManageMode = () => {
    setIsManageMode(false);
    setInlineLink("");
    setInlineStatus("idle");
    setIsRenamingFolder(false);
  };

  // ── Track renames ──────────────────────────────────────────────
  const [trackRenames, setTrackRenamesState] = useState<Record<string, string>>(
    () => (activeFolder ? getTrackRenames(activeFolder.id) : {}),
  );

  useEffect(() => {
    setTrackRenamesState(activeFolder ? getTrackRenames(activeFolder.id) : {});
  }, [activeFolder?.id]);

  const handleRenameTrack = (trackId: string, newName: string) => {
    if (!activeFolder) return;
    setTrackRename(activeFolder.id, trackId, newName);
    setTrackRenamesState(getTrackRenames(activeFolder.id));
  };

  // ── Track reorder ───────────────────────────────────────────────
  const handleReorderTracks = (from: number, to: number) => {
    if (!activeFolder) return;
    const arr = [...tracks];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    saveTracks(activeFolder.id, arr);
    dispatch({ type: "setTracks", tracks: arr });
  };

  // ── Folder rename ───────────────────────────────────────────────
  const [folderDisplayName, setFolderDisplayName] = useState<string>(() =>
    activeFolder ? (getFolderRename(activeFolder.id) ?? activeFolder.name) : "",
  );
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const folderRenameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeFolder) return;
    setFolderDisplayName(getFolderRename(activeFolder.id) ?? activeFolder.name);
  }, [activeFolder?.id]);

  const startFolderRename = () => {
    setFolderRenameValue(folderDisplayName);
    setIsRenamingFolder(true);
    setTimeout(() => folderRenameRef.current?.focus(), 30);
  };

  const commitFolderRename = () => {
    if (!activeFolder) return;
    const name = folderRenameValue.trim() || activeFolder.name;
    setFolderRename(activeFolder.id, name);
    setFolderDisplayName(name);
    setIsRenamingFolder(false);
  };

  const cancelFolderRename = () => setIsRenamingFolder(false);

  const handleFolderRenameKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitFolderRename();
    if (e.key === "Escape") cancelFolderRename();
  };

  // ── Folder reorder ──────────────────────────────────────────────
  const handleMoveFolderUp = (index: number) => {
    if (index === 0) return;
    const arr = [...folders];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    saveFolderOrder(arr);
    dispatch({ type: "setFolders", folders: arr });
    if (activeFolderIndex === index)
      dispatch({ type: "setActiveFolderIndex", index: index - 1 });
    else if (activeFolderIndex === index - 1)
      dispatch({ type: "setActiveFolderIndex", index });
  };

  const handleMoveFolderDown = (index: number) => {
    if (index >= folders.length - 1) return;
    const arr = [...folders];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    saveFolderOrder(arr);
    dispatch({ type: "setFolders", folders: arr });
    if (activeFolderIndex === index)
      dispatch({ type: "setActiveFolderIndex", index: index + 1 });
    else if (activeFolderIndex === index + 1)
      dispatch({ type: "setActiveFolderIndex", index });
  };

  // ── Inline add folder ───────────────────────────────────────────
  const [inlineLink, setInlineLink] = useState("");
  const [inlineStatus, setInlineStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const inlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isManageMode) {
      setInlineLink("");
      setInlineStatus("idle");
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    }
  }, [isManageMode]);

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
      setInlineLink("");
      setInlineStatus("idle");
    } catch {
      setInlineStatus("error");
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleInlineSubmit();
    if (e.key === "Escape") exitManageMode();
  };

  // ── Track loading ───────────────────────────────────────────────
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

  const setShowFolderModal = (show: boolean) =>
    dispatch({ type: "setShowFolderModal", show });
  const setShowFolderPicker = (show: boolean) =>
    dispatch({ type: "setShowFolderPicker", show });

  const hasNoFolders = folders.length === 0;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* New user: full-screen folder modal */}
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
          {/* Main row: folder name + Manage toggle */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            {isRenamingFolder ? (
              /* Folder rename input */
              <div className="flex-1 flex items-center gap-1.5 min-w-0 popup-slide-up">
                <input
                  ref={folderRenameRef}
                  value={folderRenameValue}
                  onChange={(e) => setFolderRenameValue(e.target.value)}
                  onKeyDown={handleFolderRenameKey}
                  className="flex-1 bg-white/6 text-white/85 text-sm font-medium rounded-lg px-2.5 py-1.5
                    outline-none focus:ring-1 focus:ring-white/20 min-w-0"
                  data-testid="input-rename-folder"
                />
                <button
                  onClick={commitFolderRename}
                  className="p-1.5 text-white/50 transition-colors shrink-0"
                  data-testid="button-rename-folder-confirm"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelFolderRename}
                  className="p-1.5 text-white/30 transition-colors shrink-0"
                  data-testid="button-rename-folder-cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              /* Folder name row */
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {folders.length === 1 ? (
                  <h1
                    className="text-white/75 text-sm font-medium truncate"
                    data-testid="text-folder-name"
                  >
                    {folderDisplayName}
                  </h1>
                ) : (
                  <button
                    onClick={() => {
                      setShowFolderPicker(!showFolderPicker);
                    }}
                    className="flex items-center gap-1.5 text-white/75 text-sm font-medium transition-colors min-w-0"
                    data-testid="button-folder-picker"
                  >
                    <span className="truncate">{folderDisplayName}</span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-white/30 transition-transform ${showFolderPicker ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
                {/* Pencil — only visible in manage mode */}
                {isManageMode && (
                  <button
                    onClick={startFolderRename}
                    className="p-1 text-white/35 transition-colors rounded shrink-0"
                    data-testid="button-rename-folder"
                    title="Rename folder"
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </div>
            )}

            {/* Manage / Close button */}
            <button
              onClick={() => {
                if (isManageMode) exitManageMode();
                else {
                  setIsManageMode(true);
                  setShowFolderPicker(false);
                }
              }}
              data-testid="button-manage"
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                isManageMode
                  ? "text-white/70 bg-white/10"
                  : "text-white/30"
              }`}
              title={isManageMode ? "Done" : "Manage"}
            >
              {isManageMode ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>

          {/* Manage mode: add folder bar */}
          {isManageMode && (
            <div className="px-4 pb-3 popup-slide-up">
              <div
                className={`flex items-center bg-white/6 rounded-xl pl-3 pr-1 h-10 min-w-0 transition-colors ${
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
                  placeholder="Paste Drive folder link..."
                  disabled={inlineStatus === "loading"}
                  className="flex-1 bg-transparent text-white/75 text-sm placeholder:text-white/25 outline-none min-w-0"
                  data-testid="input-inline-folder-link"
                />
                <button
                  onClick={handleInlineSubmit}
                  disabled={inlineStatus === "loading" || !inlineLink.trim()}
                  data-testid="button-inline-load-folder"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-white/55
                    transition-colors
                    disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {inlineStatus === "loading" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FolderOpen size={14} />
                  )}
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      {/* Folder picker dropdown */}
      {showFolderPicker && folders.length > 1 && (
        <div className="shrink-0 border-b border-white/[0.05] bg-[#060606]">
          {folders.map((folder, index) => {
            const displayName = getFolderRename(folder.id) ?? folder.name;
            return (
              <div key={folder.id} className="flex items-center">
                <button
                  onClick={() => handleSelectFolder(index)}
                  data-testid={`button-folder-${folder.id}`}
                  className={`flex-1 text-left px-4 py-3 text-sm transition-colors ${
                    index === activeFolderIndex
                      ? "text-white/90"
                      : "text-white/40"
                  }`}
                >
                  {displayName}
                </button>
                {isManageMode && (
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      onClick={() => handleMoveFolderUp(index)}
                      disabled={index === 0}
                      className="p-1.5 text-white/25 disabled:opacity-20 transition-colors"
                      data-testid={`button-folder-up-${folder.id}`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveFolderDown(index)}
                      disabled={index === folders.length - 1}
                      className="p-1.5 text-white/25 disabled:opacity-20 transition-colors"
                      data-testid={`button-folder-down-${folder.id}`}
                    >
                      <ChevronUp size={14} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => handleRemoveFolder(index)}
                      data-testid={`button-remove-folder-${folder.id}`}
                      className="px-2 py-1.5 text-red-400/50 transition-colors text-xs"
                    >
                      remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Track list */}
      {!hasNoFolders && (
        <TrackList
          tracks={tracks}
          currentTrackId={playerState.currentTrack?.id ?? null}
          isPlaying={playerState.isPlaying}
          isLoadingTracks={isLoadingTracks}
          trackRenames={trackRenames}
          isManageMode={isManageMode}
          onSelectTrack={(track, index) => playerControls.play(track, index)}
          onRenameTrack={handleRenameTrack}
          onReorderTracks={handleReorderTracks}
        />
      )}

      {/* Error toast */}
      {playerState.error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-950/80 border border-red-500/20 text-red-300/80 text-xs px-4 py-3 rounded-xl backdrop-blur-sm">
          {playerState.error}
        </div>
      )}

      {/* Mini player */}
      <MiniPlayer
        state={playerState}
        controls={playerControls}
        trackRenames={trackRenames}
      />
    </div>
  );
}
