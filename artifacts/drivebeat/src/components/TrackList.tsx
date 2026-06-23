import { Music2, Loader2 } from "lucide-react";
import type { DriveFile } from "../lib/drive";
import { cleanTrackName } from "../lib/drive";

interface TrackListProps {
  tracks: DriveFile[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isLoadingTracks: boolean;
  onSelectTrack: (track: DriveFile, index: number) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  isLoadingTracks,
  onSelectTrack,
}: TrackListProps) {
  if (isLoadingTracks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Mengambil daftar musik...</span>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25">
        <Music2 size={28} strokeWidth={1.2} />
        <span className="text-sm">Tidak ada file audio ditemukan</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none">
      <ul className="divide-y divide-white/[0.04]">
        {tracks.map((track, index) => {
          const isActive = track.id === currentTrackId;
          const displayName = cleanTrackName(track.name);
          return (
            <li key={track.id}>
              <button
                onClick={() => onSelectTrack(track, index)}
                data-testid={`track-item-${track.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/5 ${
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
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate font-[Outfit] leading-snug ${
                    isActive ? "text-white" : "text-white/65"
                  }`}>
                    {displayName}
                  </p>
                </div>
              </button>
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
