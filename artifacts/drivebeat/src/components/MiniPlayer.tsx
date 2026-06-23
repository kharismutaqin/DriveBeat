import { useState, useEffect, useRef } from "react";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Loader2,
  Timer,
  Gauge,
  Minus,
  Plus,
  ChevronUp,
  X,
} from "lucide-react";
import { formatDuration, cleanTrackName } from "../lib/drive";
import type { PlayerState, PlayerControls } from "../hooks/useAudioPlayer";

interface MiniPlayerProps {
  state: PlayerState;
  controls: PlayerControls;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function MiniPlayer({ state, controls }: MiniPlayerProps) {
  const { currentTrack, isPlaying, currentTime, duration, playbackRate, isLoading } = state;
  const [showSpeed, setShowSpeed] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dismiss popups on outside clicks
  const playerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (playerRef.current && !playerRef.current.contains(e.target as Node)) {
        setShowSpeed(false);
        setShowSleep(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const startSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepMinutes(minutes);
    setShowSleep(false);

    if (minutes <= 0) {
      setSleepRemaining(0);
      return;
    }

    const totalMs = minutes * 60 * 1000;
    const endTime = Date.now() + totalMs;
    setSleepRemaining(minutes * 60);

    sleepIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
      }
    }, 1000);

    sleepTimerRef.current = setTimeout(() => {
      controls.stop();
      setSleepMinutes(0);
      setSleepRemaining(0);
    }, totalMs);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepMinutes(0);
    setSleepRemaining(0);
    setShowSleep(false);
  };

  const adjustMinutes = (delta: number) => {
    setSleepMinutes((prev) => Math.max(0, Math.min(999, prev + delta)));
  };

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  if (!currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayName = cleanTrackName(currentTrack.name);
  const isSleepActive = sleepRemaining > 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    controls.seekTo(ratio * duration);
  };

  return (
    <div
      ref={playerRef}
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d] border-t border-white/[0.07] safe-area-bottom"
      data-testid="mini-player"
    >
      {/* Speed popup */}
      {showSpeed && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <p className="text-white/30 text-[10px] uppercase tracking-widest px-4 pt-3 pb-1.5">Kecepatan Putar</p>
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                onClick={() => { controls.setPlaybackRate(rate); setShowSpeed(false); }}
                data-testid={`button-speed-${rate}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  rate === playbackRate
                    ? "bg-white text-black"
                    : "bg-white/8 text-white/55 hover:bg-white/12"
                }`}
              >
                {rate === 1 ? "1\u00d7" : `${rate}\u00d7`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sleep timer popup */}
      {showSleep && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Sleep Timer</p>
            <button
              onClick={() => setShowSleep(false)}
              className="text-white/25 hover:text-white/60 transition-colors p-0.5"
            >
              <X size={12} />
            </button>
          </div>

          {/* Countdown display (only when active) */}
          {isSleepActive && (
            <div className="px-4 py-2">
              <div className="flex items-center justify-center gap-2 py-2 bg-white/5 rounded-lg border border-white/5">
                <Timer size={14} className="text-white/40" />
                <span className="text-white/70 text-sm font-medium tabular-nums">
                  {formatDuration(sleepRemaining)}
                </span>
                <span className="text-white/20 text-xs">tersisa</span>
              </div>
            </div>
          )}

          {/* Manual input + - */}
          <div className="flex items-center justify-center gap-4 px-4 py-3">
            <button
              onClick={() => adjustMinutes(-5)}
              data-testid="button-sleep-minus"
              className="w-9 h-9 rounded-lg bg-white/8 text-white/50 hover:text-white/80 hover:bg-white/12 transition-colors flex items-center justify-center"
            >
              <Minus size={14} />
            </button>

            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={999}
                value={sleepMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSleepMinutes(isNaN(val) ? 0 : Math.max(0, Math.min(999, val)));
                }}
                data-testid="input-sleep-minutes"
                className="w-14 bg-transparent text-white/80 text-lg font-medium text-center outline-none tabular-nums font-[Outfit]"
              />
              <span className="text-white/25 text-xs">min</span>
            </div>

            <button
              onClick={() => adjustMinutes(5)}
              data-testid="button-sleep-plus"
              className="w-9 h-9 rounded-lg bg-white/8 text-white/50 hover:text-white/80 hover:bg-white/12 transition-colors flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => startSleepTimer(sleepMinutes)}
              disabled={sleepMinutes <= 0}
              data-testid="button-sleep-start"
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                bg-white text-black hover:bg-white/90 active:bg-white/80
                disabled:bg-white/8 disabled:text-white/20 disabled:cursor-not-allowed"
            >
              {isSleepActive ? "Reset" : "Mulai"}
            </button>
            <button
              onClick={cancelSleepTimer}
              data-testid="button-sleep-off"
              className="px-4 py-2 rounded-lg text-xs font-medium transition-colors
                bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/75"
            >
              Off
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-4">
        {/* Track name — centered */}
        <p className="text-white/80 text-sm font-medium text-center leading-snug mb-3" data-testid="text-track-name">
          {displayName}
        </p>

        {/* Duration left — progress bar — duration right */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] text-white/30 tabular-nums shrink-0 w-10 text-right" data-testid="text-current-time">
            {formatDuration(currentTime)}
          </span>
          <div
            className="flex-1 h-[2px] bg-white/8 cursor-pointer relative group rounded-full"
            onClick={handleSeek}
            data-testid="progress-bar"
          >
            <div
              className="h-full bg-white/70 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-white/30 tabular-nums shrink-0 w-10" data-testid="text-duration">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          {/* Left: speed */}
          <button
            onClick={() => { setShowSpeed(!showSpeed); setShowSleep(false); }}
            data-testid="button-speed"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              showSpeed || playbackRate !== 1
                ? "bg-white/12 text-white/80"
                : "text-white/30 hover:text-white/55 hover:bg-white/6"
            }`}
          >
            <Gauge size={13} />
            <span>{playbackRate === 1 ? "1\u00d7" : `${playbackRate}\u00d7`}</span>
          </button>

          {/* Center: player controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => controls.seekBy(-5)}
              data-testid="button-seek-back"
              className="text-white/40 hover:text-white/75 transition-colors p-1.5 rounded-lg hover:bg-white/6"
              title="Mundur 5 detik"
            >
              <span className="flex items-center gap-0.5">
                <SkipBack size={14} />
                <span className="text-[10px] font-medium">5</span>
              </span>
            </button>

            <button
              onClick={controls.prevTrack}
              data-testid="button-prev"
              className="text-white/50 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/6"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={controls.togglePlayPause}
              data-testid="button-play-pause"
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95 hover:bg-white/90"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} fill="black" />
              ) : (
                <Play size={18} fill="black" className="ml-0.5" />
              )}
            </button>

            <button
              onClick={controls.nextTrack}
              data-testid="button-next"
              className="text-white/50 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/6"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={() => controls.seekBy(5)}
              data-testid="button-seek-forward"
              className="text-white/40 hover:text-white/75 transition-colors p-1.5 rounded-lg hover:bg-white/6"
              title="Maju 5 detik"
            >
              <span className="flex items-center gap-0.5">
                <span className="text-[10px] font-medium">5</span>
                <SkipForward size={14} />
              </span>
            </button>
          </div>

          {/* Right: sleep */}
          <button
            onClick={() => { setShowSleep(!showSleep); setShowSpeed(false); }}
            data-testid="button-sleep"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              showSleep || isSleepActive
                ? "bg-white/12 text-white/80"
                : "text-white/30 hover:text-white/55 hover:bg-white/6"
            }`}
          >
            <Timer size={13} />
            <span>{isSleepActive ? "On" : "Off"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
