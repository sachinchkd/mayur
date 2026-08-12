import { NextRequest, NextResponse } from "next/server";

type YouTubePlaylistItem = {
  snippet?: {
    title?: string;
    position?: number;
    resourceId?: { videoId?: string };
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
    videoOwnerChannelTitle?: string;
  };
};

type YouTubePlaylistResponse = {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
  error?: { message?: string };
};

export const runtime = "nodejs";

function isValidPlaylistId(value: string) {
  return /^[A-Za-z0-9_-]{10,100}$/.test(value);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const playlistId = request.nextUrl.searchParams.get("id")?.trim() ?? "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing YOUTUBE_API_KEY." },
      { status: 500 }
    );
  }

  if (!playlistId || !isValidPlaylistId(playlistId)) {
    return NextResponse.json({ error: "Invalid playlist ID." }, { status: 400 });
  }

  try {
    const tracks: Array<{
      videoId: string;
      title: string;
      thumbnail: string;
      channel: string;
      position: number;
    }> = [];

    let pageToken = "";
    let pageCount = 0;
    const MAX_PAGES = 20; // safety cap: up to 1,000 playlist items

    do {
      const params = new URLSearchParams({
        part: "snippet",
        maxResults: "50",
        playlistId,
        key: apiKey,
      });

      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
        {
          next: { revalidate: 1800 }, // cache each YouTube page for 30 minutes
        }
      );

      const data = (await response.json()) as YouTubePlaylistResponse;

      if (!response.ok) {
        return NextResponse.json(
          { error: data.error?.message || "YouTube API request failed." },
          { status: response.status }
        );
      }

      for (const item of data.items ?? []) {
        const videoId = item.snippet?.resourceId?.videoId;
        const title = item.snippet?.title ?? "Untitled";

        // Deleted/private playlist entries are not playable.
        if (!videoId || title === "Deleted video" || title === "Private video") continue;

        const thumbnail =
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        tracks.push({
          videoId,
          title,
          thumbnail,
          channel: item.snippet?.videoOwnerChannelTitle ?? "YouTube",
          position: item.snippet?.position ?? tracks.length,
        });
      }

      pageToken = data.nextPageToken ?? "";
      pageCount += 1;
    } while (pageToken && pageCount < MAX_PAGES);

    return NextResponse.json(
      {
        playlistId,
        tracks,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          // Browser/CDN can reuse the normalized playlist too.
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load this playlist right now." },
      { status: 500 }
    );
  }
}
