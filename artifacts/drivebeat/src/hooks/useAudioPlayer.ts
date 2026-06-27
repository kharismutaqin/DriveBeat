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
  shuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  stop: () => void;
}

export function useAudioPlayer(tracks: DriveFile[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Refs always hold the latest values — safe to use inside event handlers
  // that are set up once in useEffect([], []).
  const tracksRef = useRef(tracks);
  const currentIndexRef = useRef(-1);
  const playbackRateRef = useRef(Number(localStorage.getItem("db_playbackRate")) || 1);

  // Keep refs in sync on every render (synchronous, before any handler fires)
  tracksRef.current = tracks;

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: playbackRateRef.current,
    isLoading: false,
    error: null,
  });

  // Keep currentIndexRef in sync with state
  currentIndexRef.current = state.currentIndex;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.playbackRate = playbackRateRef.current;
    audio.preservesPitch = playbackRateRef.current === 1;
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
      const allTracks = tracksRef.current;
      const currentIdx = currentIndexRef.current;
      if (allTracks.length === 0) {
        setState((s) => ({ ...s, isPlaying: false }));
        return;
      }
      // Loop back to start when last track ends
      const nextIndex = (currentIdx + 1) % allTracks.length;
      const nextTrack = allTracks[nextIndex];
      if (!nextTrack) {
        setState((s) => ({ ...s, isPlaying: false }));
        return;
      }
      const rate = playbackRateRef.current;
      const url = getStreamUrl(nextTrack.id);
      audio.src = url;
      audio.playbackRate = rate;
      audio.preservesPitch = rate === 1;
      audio.play().catch(() => {});
      setState((s) => ({
        ...s,
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        currentTime: 0,
        duration: 0,
        isLoading: true,
        error: null,
      }));
    };

    const onWaiting = () => setState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => {
      setState((s) => {
        audio.playbackRate = s.playbackRate;
        audio.preservesPitch = s.playbackRate === 1;
        return { ...s, isLoading: false };
      });
    };
    const onError = () => {
      const errorCode = audio.error?.code;
      if (!audio.src || audio.src === "" || errorCode === 4) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Failed to load audio. Make sure the file is publicly accessible.",
      }));
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

  const play = useCallback((track: DriveFile, index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rate = playbackRateRef.current;
    const url = getStreamUrl(track.id);
    audio.src = url;
    audio.playbackRate = rate;
    audio.preservesPitch = rate === 1;
    setState((s) => ({
      ...s,
      currentTrack: track,
      currentIndex: index,
      currentTime: 0,
      duration: 0,
      isLoading: true,
      error: null,
      isPlaying: false,
    }));
    audio.play().catch(() => {});
  }, []);

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
    const allTracks = tracksRef.current;
    const currentIdx = currentIndexRef.current;
    const nextIndex = Math.max(0, currentIdx - 1);
    if (nextIndex === currentIdx) return;
    const track = allTracks[nextIndex];
    if (!track) return;
    const rate = playbackRateRef.current;
    const url = getStreamUrl(track.id);
    audio.src = url;
    audio.playbackRate = rate;
    audio.preservesPitch = rate === 1;
    audio.play().catch(() => {});
    setState((s) => ({
      ...s,
      currentTrack: track,
      currentIndex: nextIndex,
      currentTime: 0,
      duration: 0,
      isLoading: true,
      error: null,
    }));
  }, []);

  const nextTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const allTracks = tracksRef.current;
    const currentIdx = currentIndexRef.current;
    const nextIndex = Math.min(allTracks.length - 1, currentIdx + 1);
    if (nextIndex === currentIdx) return;
    const track = allTracks[nextIndex];
    if (!track) return;
    const rate = playbackRateRef.current;
    const url = getStreamUrl(track.id);
    audio.src = url;
    audio.playbackRate = rate;
    audio.preservesPitch = rate === 1;
    audio.play().catch(() => {});
    setState((s) => ({
      ...s,
      currentTrack: track,
      currentIndex: nextIndex,
      currentTime: 0,
      duration: 0,
      isLoading: true,
      error: null,
    }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(0.25, Math.min(2, Number(rate.toFixed(2))));
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
      audio.preservesPitch = false;
    }
    playbackRateRef.current = clamped;
    localStorage.setItem("db_playbackRate", String(clamped));
    setState((s) => ({ ...s, playbackRate: clamped }));
  }, []);

  const shuffle = useCallback(() => {
    const allTracks = tracksRef.current;
    if (allTracks.length === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    const randomIndex = Math.floor(Math.random() * allTracks.length);
    const track = allTracks[randomIndex];
    const rate = playbackRateRef.current;
    const url = getStreamUrl(track.id);
    audio.src = url;
    audio.playbackRate = rate;
    audio.preservesPitch = rate === 1;
    audio.play().catch(() => {});
    setState((s) => ({
      ...s,
      currentTrack: track,
      currentIndex: randomIndex,
      currentTime: 0,
      duration: 0,
      isLoading: true,
      error: null,
    }));
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setState((s) => ({
      ...s,
      currentTrack: null,
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    }));
  }, []);

  const controls: PlayerControls = {
    play,
    togglePlayPause,
    seekTo,
    seekBy,
    prevTrack,
    nextTrack,
    shuffle,
    setPlaybackRate,
    stop,
  };

  return { state, controls };
}
