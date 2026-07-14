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

export async function fetchPlayerApi(
  videoId: string,
): Promise<PlayerApiResult> {
  const client = {
    clientId: "28",
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    context: {
      clientName: "ANDROID_VR",
      clientVersion: "1.65.10",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      androidSdkVersion: 32,
      osName: "Android",
      osVersion: "12L",
    },
  };

  const ytcfg = (
    window as unknown as { ytcfg?: { data_?: Record<string, unknown> } }
  ).ytcfg;
  const data = ytcfg?.data_;
  const visitorData =
    (data?.VISITOR_DATA as string | undefined) ??
    ((
      (data?.INNERTUBE_CONTEXT as Record<string, unknown> | undefined)
        ?.client as Record<string, unknown> | undefined
    )?.visitorData as string | undefined);
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
