import { useState, useRef, useEffect, useCallback } from "react";
import type { DriveFile } from "../lib/drive";
import { getStreamUrl } from "../lib/drive";

export interface PlayerState {
  currentTrack: DriveFile | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  preservePitch: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface PlayerControls {
  play: (track: DriveFile, index: number) => void;
  togglePlayPause: () => void;
  seekTo: (time: number) => void;
  seekBy: (delta: number) => void;
  prevTrack: () => void;
  nextTrack: () => void;
  setPlaybackRate: (rate: number) => void;
  setPreservePitch: (enabled: boolean) => void;
  stop: () => void;
}

export function useAudioPlayer(tracks: DriveFile[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: Number(localStorage.getItem("db_playbackRate")) || 1,
    preservePitch: localStorage.getItem("db_preservePitch") !== "false",
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.playbackRate = state.playbackRate;
    audio.preservesPitch = state.preservePitch;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    };
    const onDurationChange = () => {
      setState((s) => ({ ...s, duration: audio.duration }));
    };
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));
    const onEnded = () => {
      setState((s) => {
        const nextIndex = s.currentIndex + 1;
        return { ...s, isPlaying: false, currentIndex: nextIndex < tracks.length ? nextIndex : s.currentIndex };
      });
    };
    const onWaiting = () => setState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => {
      audio.playbackRate = state.playbackRate;
      audio.preservesPitch = state.preservePitch;
      setState((s) => ({ ...s, isLoading: false }));
    };
    const onError = () => {
      const errorCode = audio.error?.code;
      // Code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED, which fires when src is empty or invalid
      if (!audio.src || audio.src === "" || errorCode === 4) {
        // Intentional stop or empty source - don't show error
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      setState((s) => ({ ...s, isLoading: false, error: "Gagal memuat audio. Pastikan file dapat diakses publik." }));
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Auto-play next track when currentIndex changes via "ended"
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.currentIndex >= 0 && state.currentIndex < tracks.length && !state.isPlaying && state.currentTrack) {
      const expected = tracks[state.currentIndex];
      if (expected && expected.id !== state.currentTrack.id) {
        const url = getStreamUrl(expected.id);
        audio.src = url;
        audio.playbackRate = state.playbackRate;
        setState((s) => ({ ...s, currentTrack: expected, currentTime: 0, duration: 0, isLoading: true, error: null }));
        audio.play().catch(() => {});
      }
    }
  }, [state.currentIndex]);

  const play = useCallback((track: DriveFile, index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const url = getStreamUrl(track.id);
    audio.src = url;
    audio.playbackRate = state.playbackRate;
    setState((s) => ({ ...s, currentTrack: track, currentIndex: index, currentTime: 0, duration: 0, isLoading: true, error: null, isPlaying: false }));
    audio.play().catch(() => {});
  }, [state.playbackRate]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
  }, []);

  const seekBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, audio.duration || 0));
  }, []);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setState((s) => {
      const nextIndex = Math.max(0, s.currentIndex - 1);
      if (nextIndex === s.currentIndex) return s;
      const track = tracks[nextIndex];
      if (!track) return s;
      const url = getStreamUrl(track.id);
      audio.src = url;
      audio.playbackRate = s.playbackRate;
      audio.play().catch(() => {});
      return { ...s, currentTrack: track, currentIndex: nextIndex, currentTime: 0, duration: 0, isLoading: true, error: null };
    });
  }, [tracks]);

  const nextTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setState((s) => {
      const nextIndex = Math.min(tracks.length - 1, s.currentIndex + 1);
      if (nextIndex === s.currentIndex) return s;
      const track = tracks[nextIndex];
      if (!track) return s;
      const url = getStreamUrl(track.id);
      audio.src = url;
      audio.playbackRate = s.playbackRate;
      audio.play().catch(() => {});
      return { ...s, currentTrack: track, currentIndex: nextIndex, currentTime: 0, duration: 0, isLoading: true, error: null };
    });
  }, [tracks]);

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2, Number(rate.toFixed(1))));
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
      audio.preservesPitch = true;
    }
    localStorage.setItem("db_playbackRate", String(clamped));
    localStorage.setItem("db_preservePitch", "true");
    setState((s) => ({ ...s, playbackRate: clamped, preservePitch: true }));
  }, []);

  const setPreservePitch = useCallback((enabled: boolean) => {
    const audio = audioRef.current;
    if (audio) audio.preservesPitch = enabled;
    localStorage.setItem("db_preservePitch", String(enabled));
    setState((s) => ({ ...s, preservePitch: enabled }));
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setState((s) => ({ ...s, currentTrack: null, currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0, error: null }));
  }, []);

  const controls: PlayerControls = {
    play,
    togglePlayPause,
    seekTo,
    seekBy,
    prevTrack,
    nextTrack,
    setPlaybackRate,
    setPreservePitch,
    stop,
  };

  return { state, controls };
}
