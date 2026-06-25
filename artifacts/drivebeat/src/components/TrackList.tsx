import { useState, useRef, useEffect } from "react";
import { Music2, Loader2, Pencil, Check, X } from "lucide-react";
import type { DriveFile } from "../lib/drive";
import { cleanTrackName } from "../lib/drive";

interface TrackListProps {
  tracks: DriveFile[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isLoadingTracks: boolean;
  trackRenames: Record<string, string>;
  onSelectTrack: (track: DriveFile, index: number) => void;
  onRenameTrack: (trackId: string, newName: string) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  isLoadingTracks,
  trackRenames,
  onSelectTrack,
  onRenameTrack,
}: TrackListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (track: DriveFile) => {
    const current = trackRenames[track.id] ?? cleanTrackName(track.name);
    setEditValue(current);
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
    <div className="flex-1 overflow-y-auto scrollbar-none">
      <ul className="divide-y divide-white/[0.04]">
        {tracks.map((track, index) => {
          const isActive = track.id === currentTrackId;
          const displayName = trackRenames[track.id] ?? cleanTrackName(track.name);
          const isEditing = editingId === track.id;

          return (
            <li key={track.id} className="group relative">
              {isEditing ? (
                /* Rename row */
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <div className="shrink-0 w-8" />
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, track.id)}
                    className="flex-1 bg-white/6 text-white/85 text-sm rounded-lg px-2.5 py-1.5 outline-none
                      focus:ring-1 focus:ring-white/20 font-[Outfit] min-w-0"
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
                /* Normal row */
                <div className="relative flex items-center">
                  <button
                    onClick={() => onSelectTrack(track, index)}
                    data-testid={`track-item-${track.id}`}
                    className={`flex-1 flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/5 ${
                      isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="shrink-0 w-8 flex items-center justify-center">
                      {isActive && isPlaying ? (
                        <PlayingIndicator />
                      ) : (
                        <span className={`text-xs tabular-nums ${isActive ? "text-white/60" : "text-white/18"}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <p className={`text-sm truncate font-[Outfit] leading-snug ${
                        isActive ? "text-white" : "text-white/65"
                      }`}>
                        {displayName}
                      </p>
                    </div>
                  </button>

                  {/* Rename pencil — visible on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(track); }}
                    className="absolute right-3 p-1.5 text-white/0 group-hover:text-white/25
                      hover:!text-white/65 transition-colors rounded-md hover:bg-white/6"
                    data-testid={`button-rename-track-${track.id}`}
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {/* bottom padding so last item clears mini player */}
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
