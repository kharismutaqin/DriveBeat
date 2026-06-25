import { useState, useEffect, useRef } from "react";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Loader2,
  Timer,
  Gauge,
  ChevronUp,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { formatDuration, cleanTrackName } from "../lib/drive";
import type { PlayerState, PlayerControls } from "../hooks/useAudioPlayer";

interface MiniPlayerProps {
  state: PlayerState;
  controls: PlayerControls;
}

const SPEED_STEP = 0.25;

export function MiniPlayer({ state, controls }: MiniPlayerProps) {
  const { currentTrack, isPlaying, currentTime, duration, playbackRate, isLoading } = state;
  const [showSpeed, setShowSpeed] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [sleepTotalSeconds, setSleepTotalSeconds] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSleepTimer = (totalSeconds: number) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepTotalSeconds(totalSeconds);
    setShowSleep(false);

    if (totalSeconds <= 0) {
      setSleepRemaining(0);
      return;
    }

    const totalMs = totalSeconds * 1000;
    const endTime = Date.now() + totalMs;
    setSleepRemaining(totalSeconds);

    sleepIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
      }
    }, 1000);

    sleepTimerRef.current = setTimeout(() => {
      controls.stop();
      setSleepTotalSeconds(0);
      setSleepRemaining(0);
    }, totalMs);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    setSleepTotalSeconds(0);
    setSleepRemaining(0);
    setShowSleep(false);
  };

  const adjustTime = (deltaSeconds: number) => {
    setSleepTotalSeconds((prev) => Math.max(0, Math.min(3599, prev + deltaSeconds)));
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d] border-t border-white/[0.07] safe-area-bottom"
      data-testid="mini-player"
    >
      {/* Speed panel — replaces mini player content */}
      {showSpeed && (
        <div className="px-4 pt-3 pb-4 popup-slide-up">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Playback Speed</p>
            <button
              onClick={() => setShowSpeed(false)}
              className="text-white/25 hover:text-white/60 transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          </div>

          {/* Speed adjuster */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => controls.setPlaybackRate(Math.max(0.25, Number((playbackRate - SPEED_STEP).toFixed(2))))}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80 transition-colors"
              data-testid="button-speed-minus"
            >
              <Minus size={16} />
            </button>
            <div className="w-20 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="text-white/90 text-lg font-medium tabular-nums">
                {playbackRate.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => controls.setPlaybackRate(Math.min(2, Number((playbackRate + SPEED_STEP).toFixed(2))))}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80 transition-colors"
              data-testid="button-speed-plus"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={() => controls.setPlaybackRate(1)}
            data-testid="button-speed-reset"
            className="w-full h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors bg-white/8 text-white/55 hover:bg-white/12 hover:text-white/80"
          >
            Reset
          </button>
        </div>
      )}

      {/* Sleep timer panel — replaces mini player content */}
      {showSleep && (
        <div className="px-4 pt-3 pb-4 popup-slide-up">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Sleep Timer</p>
            <button
              onClick={() => setShowSleep(false)}
              className="text-white/25 hover:text-white/60 transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          </div>

          {/* Time picker + action buttons */}
          <div className="flex items-center justify-center gap-2">
            {/* Minutes */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => adjustTime(60)} className="text-white/35 hover:text-white/70 transition-colors p-0.5">
                <ChevronUp size={14} />
              </button>
              <div className="w-12 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-white/80 text-lg font-medium tabular-nums">
                  {String(Math.floor((isSleepActive ? sleepRemaining : sleepTotalSeconds) / 60)).padStart(2, "0")}
                </span>
              </div>
              <button onClick={() => adjustTime(-60)} className="text-white/35 hover:text-white/70 transition-colors p-0.5">
                <ChevronUp size={14} className="rotate-180" />
              </button>
            </div>

            <span className="text-white/25 text-lg font-medium pb-0.5">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => adjustTime(10)} className="text-white/35 hover:text-white/70 transition-colors p-0.5">
                <ChevronUp size={14} />
              </button>
              <div className="w-12 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-white/80 text-lg font-medium tabular-nums">
                  {String((isSleepActive ? sleepRemaining : sleepTotalSeconds) % 60).padStart(2, "0")}
                </span>
              </div>
              <button onClick={() => adjustTime(-10)} className="text-white/35 hover:text-white/70 transition-colors p-0.5">
                <ChevronUp size={14} className="rotate-180" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 ml-3">
              <button
                onClick={() => startSleepTimer(isSleepActive ? sleepRemaining : sleepTotalSeconds)}
                disabled={sleepTotalSeconds <= 0 && !isSleepActive}
                data-testid="button-sleep-start"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Timer size={14} />
                <span>On</span>
              </button>
              <button
                onClick={cancelSleepTimer}
                data-testid="button-sleep-off"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90"
              >
                <Timer size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal player — hidden when a panel is open */}
      {!showSpeed && !showSleep && (
        <div className="px-4 pt-3 pb-4">
          {/* Track name */}
          <p className="text-white/80 text-sm font-medium text-center leading-snug mb-3" data-testid="text-track-name">
            {displayName}
          </p>

          {/* Progress bar */}
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
            {/* Speed toggle */}
            <button
              onClick={() => { setShowSpeed(true); setShowSleep(false); }}
              data-testid="button-speed"
              className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs transition-colors ${
                playbackRate !== 1
                  ? "bg-white/12 text-white/80"
                  : "bg-transparent text-white/30 hover:text-white/55"
              }`}
            >
              <Gauge size={16} />
            </button>

            {/* Playback controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => controls.seekBy(-5)}
                data-testid="button-seek-back"
                className="text-white/40 hover:text-white/75 transition-colors p-1.5 rounded-lg hover:bg-white/6"
                title="Rewind 5 seconds"
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
                title="Forward 5 seconds"
              >
                <span className="flex items-center gap-0.5">
                  <span className="text-[10px] font-medium">5</span>
                  <SkipForward size={14} />
                </span>
              </button>
            </div>

            {/* Sleep toggle */}
            <button
              onClick={() => { setShowSleep(true); setShowSpeed(false); }}
              data-testid="button-sleep"
              className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs transition-colors ${
                isSleepActive
                  ? "bg-white/12 text-white/80"
                  : "bg-transparent text-white/30 hover:text-white/55"
              }`}
            >
              <Timer size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
