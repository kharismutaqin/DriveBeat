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
  // ── Rename state ─────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  // Exit rename mode when manage mode turns off
  useEffect(() => {
    if (!isManageMode) setEditingId(null);
  }, [isManageMode]);

  const startEdit = (track: DriveFile) => {
    setEditValue(trackRenames[track.id] ?? cleanTrackName(track.name));
    setEditingId(track.id);
  };

  const commitEdit = (trackId: string) => {
    onRenameTrack(trackId, editValue);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleKeyDown = (e: React.KeyboardEvent, trackId: string) => {
    if (e.key === "Enter") commitEdit(trackId);
    if (e.key === "Escape") cancelEdit();
  };

  // ── Drag-to-reorder state ────────────────────────────────────
  // dragVisual: used for real-time visual reordering during touch drag
  const [dragVisual, setDragVisual] = useState<{ from: number; current: number } | null>(null);
  const draggingRef = useRef<{ from: number; current: number } | null>(null);
  const touchStartYRef = useRef(0);
  const rowHeightRef = useRef(56);
  const listRef = useRef<HTMLDivElement>(null);

  // Attach non-passive touchmove so we can preventDefault (block page scroll)
  useEffect(() => {
    const el = listRef.current;
    if (!el || !isManageMode) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const dy = e.touches[0].clientY - touchStartYRef.current;
      const rawIndex = draggingRef.current.from + Math.round(dy / rowHeightRef.current);
      const clamped = Math.max(0, Math.min(tracks.length - 1, rawIndex));
      if (clamped !== draggingRef.current.current) {
        draggingRef.current = { ...draggingRef.current, current: clamped };
        setDragVisual({ ...draggingRef.current });
      }
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [isManageMode, tracks.length]);

  const handleGripTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartYRef.current = e.touches[0].clientY;
    // measure row height from list children
    const children = listRef.current?.children;
    if (children?.[index]) {
      rowHeightRef.current = (children[index] as HTMLElement).offsetHeight || 56;
    }
    draggingRef.current = { from: index, current: index };
    setDragVisual({ from: index, current: index });
  };

  const handleTouchEnd = () => {
    const drag = draggingRef.current;
    if (drag && drag.from !== drag.current) {
      onReorderTracks(drag.from, drag.current);
    }
    draggingRef.current = null;
    setDragVisual(null);
  };

  // Compute display order during drag
  const displayedTracks = useMemo(() => {
    if (!dragVisual || dragVisual.from === dragVisual.current) return tracks;
    const arr = [...tracks];
    const [item] = arr.splice(dragVisual.from, 1);
    arr.splice(dragVisual.current, 0, item);
    return arr;
  }, [tracks, dragVisual]);

  const draggingTrackId = dragVisual ? tracks[dragVisual.from]?.id : null;

  // ── Render guards ────────────────────────────────────────────
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
      ref={listRef}
      className="flex-1 overflow-y-auto scrollbar-none"
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <ul className="divide-y divide-white/[0.04]">
        {displayedTracks.map((track, displayIndex) => {
          // original index in `tracks` (needed for onSelectTrack)
          const originalIndex = tracks.findIndex((t) => t.id === track.id);
          const isActive = track.id === currentTrackId;
          const displayName = trackRenames[track.id] ?? cleanTrackName(track.name);
          const isEditing = editingId === track.id;
          const isDraggingThis = track.id === draggingTrackId;

          return (
            <li
              key={track.id}
              className={`transition-opacity ${isDraggingThis ? "opacity-40" : "opacity-100"}`}
            >
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
                <div className={`flex items-center ${isDraggingThis ? "bg-white/6 rounded-lg" : ""}`}>
                  {/* Drag handle — only in manage mode */}
                  {isManageMode && (
                    <div
                      className="pl-3 pr-1 py-4 text-white/20 active:text-white/50 touch-none cursor-grab active:cursor-grabbing shrink-0"
                      onTouchStart={(e) => handleGripTouchStart(e, displayIndex)}
                      data-testid={`grip-${track.id}`}
                    >
                      <GripVertical size={16} />
                    </div>
                  )}

                  {/* Track button */}
                  <button
                    onClick={() => !isManageMode && onSelectTrack(track, originalIndex)}
                    data-testid={`track-item-${track.id}`}
                    className={`flex-1 flex items-center gap-3 py-3.5 text-left transition-colors min-w-0
                      ${isManageMode ? "pl-1 pr-2 active:bg-transparent cursor-default" : "px-4 active:bg-white/5"}
                      ${isActive && !isManageMode ? "bg-white/[0.06]" : !isManageMode ? "hover:bg-white/[0.03]" : ""}
                    `}
                  >
                    {/* Number / playing indicator */}
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

                  {/* Rename pencil — visible only in manage mode */}
                  {isManageMode && (
                    <button
                      onClick={() => startEdit(track)}
                      className="p-2.5 text-white/25 hover:text-white/65 active:text-white/65 transition-colors shrink-0"
                      data-testid={`button-rename-track-${track.id}`}
                      title="Rename"
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
