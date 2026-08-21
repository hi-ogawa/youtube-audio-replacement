// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/lib/youtube.ts
export interface YouTubeVideoData {
  youtubeId: string;
  title: string;
  channelName: string;
  duration: number;
}

export interface YouTubeStreamingFormat {
  url: string;
  itag: number;
  mimeType: string;
  contentLength?: number;
}

export interface PlayerApiResult {
  video: YouTubeVideoData;
  streamingFormats: YouTubeStreamingFormat[];
}

export function selectAudioFormat(formats: YouTubeStreamingFormat[]) {
  const audioFormats = formats.filter(
    (format) =>
      format.mimeType.startsWith("audio/") && Boolean(format.contentLength),
  );
  const opusFormats = audioFormats.filter((format) =>
    format.mimeType.includes("opus"),
  );
  return (opusFormats.length > 0 ? opusFormats : audioFormats).sort(
    (left, right) => (right.contentLength ?? 0) - (left.contentLength ?? 0),
  )[0];
}

export function parseVideoId(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");
    let videoId: string | undefined;
    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/")[1];
    } else if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com")
    ) {
      videoId = url.searchParams.get("v") ?? undefined;
      if (!videoId) {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (["embed", "live", "shorts"].includes(kind ?? "")) {
          videoId = id;
        }
      }
    }
    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return videoId;
    }
  } catch {
    // Not a URL.
  }
  return undefined;
}

export async function fetchPlayerApi(
  videoId: string,
): Promise<PlayerApiResult> {
  const client = {
    clientId: "101",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    context: {
      clientName: "VISIONOS",
      clientVersion: "1.02",
      deviceMake: "Apple",
      deviceModel: "RealityDevice17,1",
      osName: "visionOS",
      osVersion: "26.5.23O471",
    },
  };

  const visitorData = getVisitorData();
  if (!visitorData) {
    throw new Error("Could not extract visitorData from ytcfg");
  }

  const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": client.clientId,
      "X-YouTube-Client-Version": client.context.clientVersion,
      "X-Goog-Visitor-Id": visitorData,
      Origin: "https://www.youtube.com",
      "User-Agent": client.userAgent,
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          ...client.context,
          userAgent: client.userAgent,
          hl: "en",
          timeZone: "UTC",
          utcOffsetMinutes: 0,
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Player API returned ${response.status}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  const playabilityStatus = result.playabilityStatus as
    | Record<string, unknown>
    | undefined;
  if (playabilityStatus?.status !== "OK") {
    throw new Error(
      typeof playabilityStatus?.reason === "string"
        ? playabilityStatus.reason
        : `Video is not playable (${String(playabilityStatus?.status ?? "unknown")})`,
    );
  }
  const details = result.videoDetails as Record<string, unknown> | undefined;
  if (!details) {
    throw new Error("videoDetails not found in player API response");
  }
  const streamingData = result.streamingData as
    | Record<string, unknown>
    | undefined;
  const rawFormats = (streamingData?.adaptiveFormats ?? []) as Record<
    string,
    unknown
  >[];

  return {
    video: {
      youtubeId: String(details.videoId),
      title: String(details.title),
      channelName: String(details.author),
      duration: Number(details.lengthSeconds),
    },
    streamingFormats: rawFormats
      .filter((format) => typeof format.url === "string")
      .map((format) => ({
        url: String(format.url),
        itag: Number(format.itag),
        mimeType: String(format.mimeType),
        contentLength:
          typeof format.contentLength === "string"
            ? Number(format.contentLength)
            : undefined,
      })),
  };
}

export function getVisitorData(): string | undefined {
  const data = (
    window as unknown as { ytcfg?: { data_?: Record<string, unknown> } }
  ).ytcfg?.data_;
  return (
    (data?.VISITOR_DATA as string | undefined) ??
    ((
      (data?.INNERTUBE_CONTEXT as Record<string, unknown> | undefined)
        ?.client as Record<string, unknown> | undefined
    )?.visitorData as string | undefined)
  );
}
