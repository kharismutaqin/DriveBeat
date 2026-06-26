import { useState, useRef, useEffect, useMemo } from "react";
import { Music2, Loader2, Pencil, Check, X, GripVertical } from "lucide-react";
import type { DriveFile } from "../lib/drive";
import { cleanTrackName } from "../lib/drive";

interface TrackListProps {
  tracks: DriveFile[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isLoadingTracks: boolean;
  trackRenames: Record<string, string>;
  isManageMode: boolean;
  onSelectTrack: (track: DriveFile, index: number) => void;
  onRenameTrack: (trackId: string, newName: string) => void;
  onReorderTracks: (from: number, to: number) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  isLoadingTracks,
  trackRenames,
  isManageMode,
  onSelectTrack,
  onRenameTrack,
  onReorderTracks,
}: TrackListProps) {
  // ── Rename state ────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (!isManageMode) setEditingId(null);
  }, [isManageMode]);

  const startEdit = (track: DriveFile) => {
    setEditValue(trackRenames[track.id] ?? cleanTrackName(track.name));
    setEditingId(track.id);
  };
  const commitEdit = (trackId: string) => { onRenameTrack(trackId, editValue); setEditingId(null); };
  const cancelEdit = () => setEditingId(null);
  const handleKeyDown = (e: React.KeyboardEvent, trackId: string) => {
    if (e.key === "Enter") commitEdit(trackId);
    if (e.key === "Escape") cancelEdit();
  };

  // ── Drag-to-reorder (Pointer Events + setPointerCapture) ────────
  // Using pointer events is the correct approach for mobile drag-and-drop:
  // setPointerCapture routes all subsequent pointer events to the grip element,
  // bypassing the scroll container entirely.
  const [dragState, setDragState] = useState<{ from: number; current: number } | null>(null);
  const dragRef = useRef<{ from: number; current: number } | null>(null);
  const startYRef = useRef(0);
  const rowHeightRef = useRef(56);
  const listRef = useRef<HTMLUListElement>(null);

  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    // Capture pointer so all move/up events route here even outside this element
    e.currentTarget.setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    // Measure actual row height
    const items = listRef.current?.children;
    if (items?.[index]) {
      rowHeightRef.current = (items[index] as HTMLElement).offsetHeight || 56;
    }
    dragRef.current = { from: index, current: index };
    setDragState({ from: index, current: index });
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dy = e.clientY - startYRef.current;
    const rawIndex = dragRef.current.from + Math.round(dy / rowHeightRef.current);
    const clamped = Math.max(0, Math.min(tracks.length - 1, rawIndex));
    if (clamped !== dragRef.current.current) {
      dragRef.current = { ...dragRef.current, current: clamped };
      setDragState({ ...dragRef.current });
    }
  };

  const handleGripPointerUp = () => {
    const drag = dragRef.current;
    if (drag && drag.from !== drag.current) {
      onReorderTracks(drag.from, drag.current);
    }
    dragRef.current = null;
    setDragState(null);
  };

  // Reorder display list during drag for real-time visual feedback
  const displayedTracks = useMemo(() => {
    if (!dragState || dragState.from === dragState.current) return tracks;
    const arr = [...tracks];
    const [item] = arr.splice(dragState.from, 1);
    arr.splice(dragState.current, 0, item);
    return arr;
  }, [tracks, dragState]);

  const draggingTrackId = dragState ? tracks[dragState.from]?.id : null;
  const isDragging = dragState !== null;

  // ── Render guards ───────────────────────────────────────────────
  if (isLoadingTracks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading music list...</span>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25">
        <Music2 size={28} strokeWidth={1.2} />
        <span className="text-sm">No audio files found</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 scrollbar-none"
      style={{ overflowY: isDragging ? "hidden" : "auto" }}
    >
      <ul ref={listRef} className="divide-y divide-white/[0.04]">
        {displayedTracks.map((track, displayIndex) => {
          const originalIndex = tracks.findIndex((t) => t.id === track.id);
          const isActive = track.id === currentTrackId;
          const displayName = trackRenames[track.id] ?? cleanTrackName(track.name);
          const isEditing = editingId === track.id;
          const isDraggingThis = track.id === draggingTrackId;

          return (
            <li key={track.id}>
              {isManageMode && isEditing ? (
                /* ── Rename row ── */
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <div className="shrink-0 w-7" />
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, track.id)}
                    className="flex-1 bg-white/6 text-white/85 text-sm rounded-lg px-2.5 py-1.5
                      outline-none focus:ring-1 focus:ring-white/20 font-[Outfit] min-w-0"
                    data-testid={`input-rename-track-${track.id}`}
                  />
                  <button
                    onClick={() => commitEdit(track.id)}
                    className="p-1.5 text-white/50 hover:text-white/90 transition-colors shrink-0"
                    data-testid={`button-rename-confirm-${track.id}`}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 text-white/30 hover:text-white/65 transition-colors shrink-0"
                    data-testid={`button-rename-cancel-${track.id}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                /* ── Normal / manage row ── */
                <div
                  className={`flex items-center transition-all duration-100 ${
                    isDraggingThis
                      ? "opacity-40 bg-white/5"
                      : "opacity-100"
                  }`}
                >
                  {/* Grip handle — only in manage mode */}
                  {isManageMode && (
                    <div
                      className="pl-3 pr-2 py-4 text-white/20 shrink-0 select-none"
                      style={{ touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
                      onPointerDown={(e) => handleGripPointerDown(e, displayIndex)}
                      onPointerMove={handleGripPointerMove}
                      onPointerUp={handleGripPointerUp}
                      onPointerCancel={handleGripPointerUp}
                      data-testid={`grip-${track.id}`}
                    >
                      <GripVertical size={16} />
                    </div>
                  )}

                  {/* Track button */}
                  <button
                    onClick={() => {
                      if (!isManageMode && !isDragging) onSelectTrack(track, originalIndex);
                    }}
                    data-testid={`track-item-${track.id}`}
                    className={`flex-1 flex items-center gap-3 py-3.5 text-left min-w-0
                      ${isManageMode ? "pl-1 pr-2 cursor-default" : "px-4 transition-colors active:bg-white/5"}
                      ${isActive && !isManageMode ? "bg-white/[0.06]" : !isManageMode ? "hover:bg-white/[0.03]" : ""}
                    `}
                  >
                    {/* Number / playing indicator (normal mode only) */}
                    {!isManageMode && (
                      <div className="shrink-0 w-8 flex items-center justify-center">
                        {isActive && isPlaying ? (
                          <PlayingIndicator />
                        ) : (
                          <span className={`text-xs tabular-nums ${isActive ? "text-white/60" : "text-white/18"}`}>
                            {String(originalIndex + 1).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Track name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate font-[Outfit] leading-snug ${
                        isActive && !isManageMode ? "text-white" : "text-white/65"
                      }`}>
                        {displayName}
                      </p>
                    </div>
                  </button>

                  {/* Pencil — always visible in manage mode */}
                  {isManageMode && (
                    <button
                      onClick={() => startEdit(track)}
                      className="p-3 text-white/20 active:text-white/65 transition-colors shrink-0"
                      data-testid={`button-rename-track-${track.id}`}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="h-36" />
    </div>
  );
}

function PlayingIndicator() {
  return (
    <div className="flex items-end gap-[2px] h-4" aria-label="Playing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white/70"
          style={{
            height: "100%",
            animation: `bounce-bar 0.9s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce-bar {
          from { transform: scaleY(0.2); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
