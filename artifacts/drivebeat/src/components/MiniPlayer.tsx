import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MarqueeText } from "./MarqueeText";
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
  Shuffle,
} from "lucide-react";
import { formatDuration, cleanTrackName } from "../lib/drive";
import type { PlayerState, PlayerControls } from "../hooks/useAudioPlayer";

interface MiniPlayerProps {
  state: PlayerState;
  controls: PlayerControls;
  trackRenames?: Record<string, string>;
  hasTracks?: boolean;
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
  hasTracks = false,
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
      setShowSleep(false);
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

  if (!currentTrack && !hasTracks) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayName = currentTrack
    ? (trackRenames[currentTrack.id] ?? cleanTrackName(currentTrack.name))
    : "";
  const isSleepActive = sleepRemaining > 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    controls.seekTo(ratio * duration);
  };

  // Determine which panel key to render inside AnimatePresence
  const activePanel = showSpeed
    ? "speed"
    : showSleep
    ? "sleep"
    : currentTrack && isPlaying
    ? "track"
    : hasTracks
    ? "shuffle"
    : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom"
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

            {activePanel === "shuffle" && (
              <motion.div
                key="shuffle"
                className="w-full"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelTransition}
              >
                <button
                  onClick={controls.shufflePlay}
                  className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-foreground/6 text-foreground/60 text-sm font-medium active:bg-foreground/10 transition-colors"
                >
                  <Shuffle size={15} />
                  Shuffle Play
                </button>
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
                <div className="mb-3 px-4">
                  <MarqueeText
                    text={displayName}
                    className="text-foreground/80 text-sm font-medium text-center leading-snug"
                  />
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-[11px] text-foreground/30 tabular-nums shrink-0 w-10 text-right"
                    data-testid="text-current-time"
                  >
                    {formatDuration(currentTime)}
                  </span>
                  <div
                    className="flex-1 h-[5px] bg-foreground/8 cursor-pointer relative group rounded-full"
                    onClick={handleSeek}
                    data-testid="progress-bar"
                  >
                    <div
                      className="h-full bg-foreground/70 rounded-full transition-none"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span
                    className="text-[11px] text-foreground/30 tabular-nums shrink-0 w-10"
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
                ? "bg-foreground/12 text-foreground/80"
                : "bg-transparent text-foreground/30"
            }`}
          >
            <CircleGauge size={18} />
          </button>

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => controls.seekBy(-5)}
              data-testid="button-seek-back"
              className="text-foreground/40 transition-colors p-1.5 rounded-lg"
              title="Rewind 5 seconds"
            >
              <span className="flex items-center gap-0.5">
                <Rewind size={18} />
              </span>
            </button>

            <button
              onClick={controls.prevTrack}
              data-testid="button-prev"
              className="text-foreground/50 transition-colors p-1.5 rounded-lg"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={() => {
                if (currentTrack) {
                  controls.togglePlayPause();
                } else if (hasTracks) {
                  controls.shufflePlay();
                }
              }}
              data-testid="button-play-pause"
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95"
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
              className="text-foreground/50 transition-colors p-1.5 rounded-lg"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={() => controls.seekBy(5)}
              data-testid="button-seek-forward"
              className="text-foreground/40 transition-colors p-1.5 rounded-lg"
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
                ? "bg-foreground/12 text-foreground/80"
                : "bg-transparent text-foreground/30"
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
        className="w-10 h-9 flex items-center justify-center rounded-lg bg-foreground/8 text-foreground/55 transition-colors shrink-0"
        data-testid="button-speed-minus"
      >
        <Minus size={16} />
      </button>

      <div className="flex-1 h-9 bg-foreground/10 rounded-lg flex items-center justify-center">
        <span className="text-foreground/90 text-base font-medium tabular-nums">
          {playbackRate.toFixed(2)}
        </span>
      </div>

      <button
        onClick={() =>
          onChange(Math.min(2, Number((playbackRate + SPEED_STEP).toFixed(2))))
        }
        className="w-10 h-9 flex items-center justify-center rounded-lg bg-foreground/8 text-foreground/55 transition-colors shrink-0"
        data-testid="button-speed-plus"
      >
        <Plus size={16} />
      </button>

      <button
        onClick={() => onChange(1)}
        data-testid="button-speed-reset"
        className="h-9 px-2.5 rounded-lg text-sm font-medium transition-colors bg-foreground/8 text-foreground/55 shrink-0"
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
      <div className="flex items-center bg-foreground/8 rounded-lg h-9">
        <button
          onClick={() => onAdjust(-60)}
          className="w-8 h-9 flex items-center justify-center text-foreground/40 transition-colors"
        >
          <Minus size={12} />
        </button>
        <div className="w-9 h-9 flex items-center justify-center bg-foreground/5 rounded-lg">
          <span className="text-foreground/85 text-sm font-medium tabular-nums">{mins}</span>
        </div>
        <button
          onClick={() => onAdjust(60)}
          className="w-8 h-9 flex items-center justify-center text-foreground/40 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      <span className="text-foreground/25 text-sm font-medium">:</span>

      {/* Seconds */}
      <div className="flex items-center bg-foreground/8 rounded-lg h-9">
        <button
          onClick={() => onAdjust(-1)}
          className="w-8 h-9 flex items-center justify-center text-foreground/40 transition-colors"
        >
          <Minus size={12} />
        </button>
        <div className="w-9 h-9 flex items-center justify-center bg-foreground/5 rounded-lg">
          <span className="text-foreground/85 text-sm font-medium tabular-nums">{secs}</span>
        </div>
        <button
          onClick={() => onAdjust(1)}
          className="w-8 h-9 flex items-center justify-center text-foreground/40 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      <button
        onClick={onCancel}
        className="h-9 px-3 rounded-lg text-xs font-medium transition-colors bg-foreground/10 text-foreground/70 shrink-0"
      >
        Reset
      </button>
    </div>
  );
}
