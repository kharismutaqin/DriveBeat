import { Router, type Request, type Response } from "express";

const router = Router();
const API_KEY = process.env.VITE_GOOGLE_DRIVE_API_KEY;

if (!API_KEY) {
  console.warn("VITE_GOOGLE_DRIVE_API_KEY not set. Drive proxy routes will return 503.");
}

function getDriveUrl(path: string, searchParams: URLSearchParams): string {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  url.searchParams.set("key", API_KEY!);
  for (const [key, value] of searchParams) {
    if (key !== "key") url.searchParams.set(key, value);
  }
  return url.toString();
}

function handleError(err: unknown, res: Response) {
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: "Proxy error", message });
}

const proxyHeaders = {
  "Referer": "https://www.google.com",
  "Origin": "https://www.google.com",
  "User-Agent": "Mozilla/5.0 (compatible; DriveBeat/1.0)",
};

router.get("/drive/files", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "API Key not configured" });
  }
  try {
    const url = getDriveUrl("files", new URLSearchParams(req.query as Record<string, string>));
    const apiRes = await fetch(url, { headers: proxyHeaders });
    res.status(apiRes.status);
    const data = await apiRes.text();
    res.setHeader("Content-Type", apiRes.headers.get("Content-Type") || "application/json");
    res.send(data);
  } catch (err) {
    handleError(err, res);
  }
});

router.get("/drive/files/:id", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "API Key not configured" });
  }
  try {
    const url = getDriveUrl(`files/${req.params.id}`, new URLSearchParams(req.query as Record<string, string>));
    const apiRes = await fetch(url, { headers: proxyHeaders });
    res.status(apiRes.status);
    const data = await apiRes.text();
    res.setHeader("Content-Type", apiRes.headers.get("Content-Type") || "application/json");
    res.send(data);
  } catch (err) {
    handleError(err, res);
  }
});

router.get("/drive/media/:id", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "API Key not configured" });
  }
  try {
    const url = getDriveUrl(`files/${req.params.id}`, new URLSearchParams(req.query as Record<string, string>));
    const apiRes = await fetch(url, { headers: proxyHeaders });
    res.status(apiRes.status);
    // Stream the response for audio files
    if (apiRes.headers.get("Content-Type")?.includes("audio/") || apiRes.headers.get("Content-Type")?.includes("video/")) {
      res.setHeader("Content-Type", apiRes.headers.get("Content-Type") || "application/octet-stream");
      res.setHeader("Content-Length", apiRes.headers.get("Content-Length") || "");
      res.setHeader("Accept-Ranges", "bytes");
    } else {
      res.setHeader("Content-Type", apiRes.headers.get("Content-Type") || "application/json");
    }
    if (apiRes.body) {
      const reader = apiRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.send(await apiRes.text());
    }
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
