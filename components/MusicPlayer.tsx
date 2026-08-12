"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Track = {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  position: number;
};

type PlaylistResponse = {
  playlistId: string;
  tracks: Track[];
  error?: string;
};

type YTPlayer = {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          width?: string;
          height?: string;
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function extractPlaylistId(input: string) {
  const value = input.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.searchParams.get("list")?.trim() ?? "";
  } catch {
    return value;
  }
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
      <path d="M6.5 5h2.3v14H6.5z" />
      <path d="M19 5.3v13.4L9.4 12 19 5.3z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
      <path d="M15.2 5h2.3v14h-2.3z" />
      <path d="M5 5.3v13.4l9.6-6.7L5 5.3z" />
    </svg>
  );
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="currentColor">
      <rect x="6.4" y="5" width="4" height="14" rx="1" />
      <rect x="13.6" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 translate-x-[1px]" fill="currentColor">
      <path d="M8 5.2v13.6L19 12 8 5.2z" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

export default function MusicPlayer() {
  const defaultPlaylist = process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_ID ?? "";

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const playerRef = useRef<YTPlayer | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatOneRef = useRef(false);

  const currentTrack = tracks[currentIndex];
  const controlsDisabled = !tracks.length || !playerReady;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    repeatOneRef.current = repeatOne;
  }, [repeatOne]);

  const playIndex = useCallback((index: number, autoplay = true) => {
    const allTracks = tracksRef.current;
    const player = playerRef.current;
    if (!allTracks.length || !player) return;

    const normalized = ((index % allTracks.length) + allTracks.length) % allTracks.length;
    indexRef.current = normalized;
    setCurrentIndex(normalized);
    setElapsed(0);
    setDuration(0);
    setLiked(false);

    if (autoplay) {
      player.loadVideoById(allTracks[normalized].videoId);
      setPlaying(true);
    } else {
      player.cueVideoById(allTracks[normalized].videoId);
      setPlaying(false);
    }
  }, []);

  const playNext = useCallback(() => {
    const allTracks = tracksRef.current;
    if (!allTracks.length) return;

    if (repeatOneRef.current) {
      playIndex(indexRef.current, true);
      return;
    }

    if (shuffleRef.current && allTracks.length > 1) {
      let nextIndex = indexRef.current;
      while (nextIndex === indexRef.current) {
        nextIndex = Math.floor(Math.random() * allTracks.length);
      }
      playIndex(nextIndex, true);
      return;
    }

    playIndex(indexRef.current + 1, true);
  }, [playIndex]);

  const createPlayer = useCallback((firstVideoId: string) => {
    if (!window.YT || playerRef.current) return;

    playerRef.current = new window.YT.Player("youtube-player", {
      width: "1",
      height: "1",
      videoId: firstVideoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event) => {
          event.target.setVolume(82);
          setPlayerReady(true);
        },
        onStateChange: (event) => {
          if (!window.YT) return;
          if (event.data === window.YT.PlayerState.PLAYING) setPlaying(true);
          if (event.data === window.YT.PlayerState.PAUSED) setPlaying(false);
          if (event.data === window.YT.PlayerState.ENDED) playNext();
        },
        onError: () => playNext(),
      },
    });
  }, [playNext]);

  useEffect(() => {
    if (!tracks.length || playerRef.current) return;
    const firstVideoId = tracks[0].videoId;

    if (window.YT?.Player) {
      createPlayer(firstVideoId);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      createPlayer(firstVideoId);
    };
  }, [tracks, createPlayer]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !playerReady) return;
      setElapsed(player.getCurrentTime() || 0);
      setDuration(player.getDuration() || 0);
    }, 500);

    return () => window.clearInterval(timer);
  }, [playerReady]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const loadPlaylist = useCallback(async (rawValue: string) => {
    const id = extractPlaylistId(rawValue);
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const cacheKey = `mayur:playlist:${id}`;

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { cachedAt: number; data: PlaylistResponse };
          if (Date.now() - parsed.cachedAt < 30 * 60 * 1000 && parsed.data.tracks?.length) {
            playerRef.current?.destroy();
            playerRef.current = null;
            setPlayerReady(false);
            setPlaying(false);
            setElapsed(0);
            setDuration(0);
            setCurrentIndex(0);
            indexRef.current = 0;
            tracksRef.current = parsed.data.tracks;
            setTracks(parsed.data.tracks);
            setLoading(false);
            return;
          }
        }
      } catch {}

      const response = await fetch(`/api/playlist?id=${encodeURIComponent(id)}`);
      const data = (await response.json()) as PlaylistResponse;

      if (!response.ok) throw new Error(data.error || "Could not load playlist.");
      if (!data.tracks.length) throw new Error("This playlist has no playable videos.");

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
        localStorage.setItem("mayur:last-playlist", id);
      } catch {}

      playerRef.current?.destroy();
      playerRef.current = null;
      setPlayerReady(false);
      setPlaying(false);
      setElapsed(0);
      setDuration(0);
      setCurrentIndex(0);
      indexRef.current = 0;
      tracksRef.current = data.tracks;
      setTracks(data.tracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load playlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let playlist = "";

    try {
      const queryPlaylist = new URLSearchParams(window.location.search).get("playlist") ?? "";
      const savedPlaylist = localStorage.getItem("mayur:last-playlist") ?? localStorage.getItem("pulse:last-playlist") ?? "";
      playlist = queryPlaylist || defaultPlaylist || savedPlaylist;
    } catch {
      playlist = defaultPlaylist;
    }

    if (playlist) loadPlaylist(playlist);
  }, [defaultPlaylist, loadPlaylist]);

  function togglePlayback() {
    const player = playerRef.current;
    if (!player || !playerReady) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  const title = currentTrack?.title ?? (loading ? "Loading playlist…" : "Mayur Yatayat");
  const artist = currentTrack?.channel ?? (error ? "Playlist unavailable" : "Your journey, your music");
  const artwork = currentTrack?.thumbnail || "/cover.svg";

  return (
    <main
      className="relative h-[100dvh] min-h-[520px] w-full overflow-hidden bg-slate-950 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/hero.png')" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-slate-950/35 to-transparent" />

      <section
        aria-label="Music player"
        className="fixed bottom-[clamp(18px,4vh,42px)] left-1/2 z-20 w-[min(520px,calc(100vw-28px))] -translate-x-1/2 rounded-[32px] border border-white/[0.16] bg-black/[0.12]
    backdrop-blur-[38px]
    backdrop-saturate-[190%]
    backdrop-brightness-75 px-7 pb-5 pt-6 text-white shadow-[0_28px_80px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[28px] backdrop-saturate-[145%] max-sm:rounded-[26px] max-sm:px-5 max-sm:pb-4 max-sm:pt-5"
      >
        <div className="flex items-center gap-5 max-sm:gap-4">
          <img
            src={artwork}
            alt=""
            className="h-[88px] w-[88px] shrink-0 rounded-2xl object-cover shadow-2xl shadow-black/40 max-sm:h-[72px] max-sm:w-[72px] max-sm:rounded-xl"
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em] max-sm:text-[17px]">{title}</h1>
            <p className="mt-1 truncate text-[16px] text-white/55 max-sm:text-sm">{artist}</p>
          </div>

          <button
            type="button"
            onClick={() => setLiked((value) => !value)}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:scale-105 hover:bg-white/10 ${liked ? "text-rose-300" : "text-white/60 hover:text-white"}`}
            aria-label={liked ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={liked}
          >
            <HeartIcon filled={liked} />
          </button>
        </div>

        <div className="mt-5">
          <div className="relative flex h-4 items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/[0.16]" />
            <div className="absolute left-0 h-1 rounded-full bg-white" style={{ width: `${progress}%` }} />
            <input
              className="music-range relative z-10"
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(elapsed, Math.max(duration, 1))}
              onChange={(event) => {
                const next = Number(event.target.value);
                setElapsed(next);
                playerRef.current?.seekTo(next, true);
              }}
              disabled={controlsDisabled}
              aria-label="Seek"
            />
          </div>

          <div className="mt-0.5 flex justify-between text-[12px] font-medium text-white/30">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setShuffle((value) => !value)}
            className={`relative grid h-11 w-11 place-items-center rounded-full transition hover:scale-110 hover:bg-white/10 disabled:cursor-default disabled:opacity-35 ${shuffle ? "text-white" : "text-white/85"}`}
            disabled={!tracks.length}
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <ShuffleIcon />
            {shuffle && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />}
          </button>

          <button
            type="button"
            onClick={() => playIndex(currentIndex - 1, true)}
            className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:scale-110 hover:bg-white/10 disabled:cursor-default disabled:opacity-35"
            disabled={controlsDisabled}
            aria-label="Previous track"
          >
            <PrevIcon />
          </button>

          <button
            type="button"
            onClick={togglePlayback}
            className="grid h-[58px] w-[58px] place-items-center rounded-full bg-white text-slate-950 shadow-xl shadow-black/30 transition hover:scale-105 hover:bg-white/95 disabled:cursor-default disabled:opacity-55 max-sm:h-[54px] max-sm:w-[54px]"
            disabled={controlsDisabled}
            aria-label={playing ? "Pause" : "Play"}
          >
            <PlayPauseIcon playing={playing} />
          </button>

          <button
            type="button"
            onClick={playNext}
            className="grid h-12 w-12 place-items-center rounded-full text-white transition hover:scale-110 hover:bg-white/10 disabled:cursor-default disabled:opacity-35"
            disabled={controlsDisabled}
            aria-label="Next track"
          >
            <NextIcon />
          </button>

          <button
            type="button"
            onClick={() => setRepeatOne((value) => !value)}
            className={`relative grid h-11 w-11 place-items-center rounded-full transition hover:scale-110 hover:bg-white/10 disabled:cursor-default disabled:opacity-35 ${repeatOne ? "text-white" : "text-white/85"}`}
            disabled={!tracks.length}
            aria-label="Repeat current track"
            aria-pressed={repeatOne}
          >
            <RepeatIcon />
            {repeatOne && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />}
          </button>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-0 right-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <div id="youtube-player" />
      </div>
    </main>
  );
}
