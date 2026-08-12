# Mayur Yatayat — Glass Music Player

A full-screen Next.js + React + TypeScript landing page using Tailwind CSS. The page uses the Mayur Yatayat hero artwork as the background and places a Spotify-inspired transparent glass music player at the bottom center.

## What changed

- Removed the old Pulse header, form, playlist cards, queue, filter, and footer.
- Added `public/hero.png` as the full-screen background image.
- Added a bottom-center glass / dynamic-island-style player.
- Added Tailwind CSS.
- Kept the existing YouTube playlist metadata API and IFrame playback logic.
- Added shuffle, previous, play/pause, next, repeat-one, favorite, and seeking UI.
- Added responsive mobile sizing.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add your YouTube Data API v3 key in `.env.local`:

   ```env
   YOUTUBE_API_KEY=YOUR_KEY
   NEXT_PUBLIC_DEFAULT_PLAYLIST_ID=PLxxxxxxxxxxxxxxxx
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Playlist selection

There is intentionally no playlist form on the landing page. Set the default playlist with `NEXT_PUBLIC_DEFAULT_PLAYLIST_ID`.

For quick testing you can also pass a playlist in the URL:

```text
http://localhost:3000/?playlist=PLxxxxxxxxxxxxxxxx
```

The most recently loaded playlist is cached in local storage and reused on later visits.

## Change the hero image

Replace:

```text
public/hero.png
```

Keep the same filename, or change the URL in `components/MusicPlayer.tsx`.

## Notes

- Playlist metadata uses YouTube Data API v3 through `app/api/playlist/route.ts`.
- Playback uses one persistent YouTube IFrame Player API instance.
- The player still needs a valid `YOUTUBE_API_KEY` to load playlist metadata.
