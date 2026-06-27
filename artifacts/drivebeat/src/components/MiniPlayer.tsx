import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Loader2,
  Timer,
  CircleGauge,
  Minus,
  Plus,
  FastForward,
  Rewind,
} from "lucide-react";
import { formatDuration, cleanTrackName } from "../lib/drive";
import type { PlayerState, PlayerControls } from "../hooks/useAudioPlayer";

interface MiniPlayerProps {
  state: PlayerState;
  controls: PlayerControls;
  trackRenames?: Record<string, string>;
}

const SPEED_STEP = 0.25;

const panelVariants = {
  initial: { y: 10, opacity: 0, scale: 0.98 },
  animate: { y: 0, opacity: 1, scale: 1 },
  exit: { y: 10, opacity: 0, scale: 0.98 },
};
const panelTransition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

export function MiniPlayer({
  state,
  controls,
  trackRenames = {},
}: MiniPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    isLoading,
  } = state;
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
  };

  const adjustTime = (deltaSeconds: number) => {
    const next = Math.max(0, Math.min(3599, sleepTotalSeconds + deltaSeconds));
    setSleepTotalSeconds(next);
    if (next > 0) {
      startSleepTimer(next);
    } else {
      cancelSleepTimer();
    }
  };

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  if (!currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayName =
    trackRenames[currentTrack.id] ?? cleanTrackName(currentTrack.name);
  const isSleepActive = sleepRemaining > 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    controls.seekTo(ratio * duration);
  };

  // Determine which panel key to render inside AnimatePresence
  const activePanel = showSpeed ? "speed" : showSleep ? "sleep" : "track";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d] border-t border-white/[0.07] safe-area-bottom"
      data-testid="mini-player"
    >
      <div className="px-4 pt-3 pb-4">
        {/* ── Top section: animated panel swap ─────────────────────── */}
        <div className="mb-3 min-h-[52px] flex items-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {activePanel === "speed" && (
              <motion.div
                key="speed"
                className="w-full"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelTransition}
              >
                <SpeedPanel
                  playbackRate={playbackRate}
                  onChange={controls.setPlaybackRate}
                />
              </motion.div>
            )}

            {activePanel === "sleep" && (
              <motion.div
                key="sleep"
                className="w-full"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelTransition}
              >
                <SleepPanel
                  isSleepActive={isSleepActive}
                  sleepRemaining={sleepRemaining}
                  sleepTotalSeconds={sleepTotalSeconds}
                  onAdjust={adjustTime}
                  onCancel={cancelSleepTimer}
                />
              </motion.div>
            )}

            {activePanel === "track" && (
              <motion.div
                key="track"
                className="w-full"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelTransition}
              >
                {/* Track name */}
                <p
                  className="text-white/80 text-sm font-medium text-center leading-snug mb-3"
                  data-testid="text-track-name"
                >
                  {displayName}
                </p>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-[11px] text-white/30 tabular-nums shrink-0 w-10 text-right"
                    data-testid="text-current-time"
                  >
                    {formatDuration(currentTime)}
                  </span>
                  <div
                    className="flex-1 h-[5px] bg-white/8 cursor-pointer relative group rounded-full"
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
                  <span
                    className="text-[11px] text-white/30 tabular-nums shrink-0 w-10"
                    data-testid="text-duration"
                  >
                    {formatDuration(duration)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls row — always visible ──────────────────────────── */}
        <div className="flex items-center justify-between">
          {/* Speed toggle */}
          <button
            onClick={() => {
              setShowSpeed((prev) => {
                const next = !prev;
                if (next) setShowSleep(false);
                return next;
              });
            }}
            data-testid="button-speed"
            className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs transition-colors ${
              showSpeed || playbackRate !== 1
                ? "bg-white/12 text-white/80"
                : "bg-transparent text-white/30 hover:text-white/55"
            }`}
          >
            <CircleGauge size={18} />
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
                <Rewind size={18} />
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
                <FastForward size={18} />
              </span>
            </button>
          </div>

          {/* Sleep toggle */}
          <button
            onClick={() => {
              setShowSleep((prev) => {
                const next = !prev;
                if (next) setShowSpeed(false);
                return next;
              });
            }}
            data-testid="button-sleep"
            className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs transition-colors ${
              showSleep || isSleepActive
                ? "bg-white/12 text-white/80"
                : "bg-transparent text-white/30 hover:text-white/55"
            }`}
          >
            <Timer size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Speed panel ─────────────────────────────────────────────────── */
function SpeedPanel({
  playbackRate,
  onChange,
}: {
  playbackRate: number;
  onChange: (rate: number) => void;
}) {
  return (
    <div className="w-full flex items-center gap-2">
      <button
        onClick={() =>
          onChange(Math.max(0.25, Number((playbackRate - SPEED_STEP).toFixed(2))))
        }
        className="w-10 h-9 flex items-center justify-center rounded-lg bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80 transition-colors shrink-0"
        data-testid="button-speed-minus"
      >
        <Minus size={16} />
      </button>

      <div className="flex-1 h-9 bg-white/10 rounded-lg flex items-center justify-center">
        <span className="text-white/90 text-base font-medium tabular-nums">
          {playbackRate.toFixed(2)}
        </span>
      </div>

      <button
        onClick={() =>
          onChange(Math.min(2, Number((playbackRate + SPEED_STEP).toFixed(2))))
        }
        className="w-10 h-9 flex items-center justify-center rounded-lg bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80 transition-colors shrink-0"
        data-testid="button-speed-plus"
      >
        <Plus size={16} />
      </button>

      <button
        onClick={() => onChange(1)}
        data-testid="button-speed-reset"
        className="h-9 px-2.5 rounded-lg text-sm font-medium transition-colors bg-white/8 text-white/55 hover:bg-white/12 hover:text-white/80 shrink-0"
      >
        Reset
      </button>
    </div>
  );
}

/* ── Sleep panel ─────────────────────────────────────────────────── */
function SleepPanel({
  isSleepActive,
  sleepRemaining,
  sleepTotalSeconds,
  onAdjust,
  onCancel,
}: {
  isSleepActive: boolean;
  sleepRemaining: number;
  sleepTotalSeconds: number;
  onAdjust: (delta: number) => void;
  onCancel: () => void;
}) {
  const displaySeconds = isSleepActive ? sleepRemaining : sleepTotalSeconds;
  const mins = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
  const secs = String(displaySeconds % 60).padStart(2, "0");

  return (
    <div className="w-full flex items-center justify-center gap-3">
      {/* Minutes */}
      <div className="flex items-center bg-white/8 rounded-lg h-9">
        <button
          onClick={() => onAdjust(-60)}
          className="w-8 h-9 flex items-center justify-center text-white/40 hover:text-white/75 transition-colors"
        >
          <Minus size={12} />
        </button>
        <div className="w-9 h-9 flex items-center justify-center bg-white/5 rounded-lg">
          <span className="text-white/85 text-sm font-medium tabular-nums">{mins}</span>
        </div>
        <button
          onClick={() => onAdjust(60)}
          className="w-8 h-9 flex items-center justify-center text-white/40 hover:text-white/75 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      <span className="text-white/25 text-sm font-medium">:</span>

      {/* Seconds */}
      <div className="flex items-center bg-white/8 rounded-lg h-9">
        <button
          onClick={() => onAdjust(-10)}
          className="w-8 h-9 flex items-center justify-center text-white/40 hover:text-white/75 transition-colors"
        >
          <Minus size={12} />
        </button>
        <div className="w-9 h-9 flex items-center justify-center bg-white/5 rounded-lg">
          <span className="text-white/85 text-sm font-medium tabular-nums">{secs}</span>
        </div>
        <button
          onClick={() => onAdjust(10)}
          className="w-8 h-9 flex items-center justify-center text-white/40 hover:text-white/75 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      <button
        onClick={onCancel}
        className="h-9 px-3 rounded-lg text-xs font-medium transition-colors bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90 shrink-0"
      >
        Reset
      </button>
    </div>
  );
}
