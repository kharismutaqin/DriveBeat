const API_KEY = process.env.VITE_GOOGLE_DRIVE_API_KEY;

export default async function handler(req, res) {
  if (!API_KEY) {
    return res.status(503).json({ error: "API Key not configured" });
  }

  const { id, ...rest } = req.query ?? {};

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`);
  url.searchParams.set("key", API_KEY);

  for (const [key, value] of Object.entries(rest)) {
    if (key !== "key" && typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const apiRes = await fetch(url.toString(), {
      headers: {
        "Referer": "https://www.google.com",
        "User-Agent": "Mozilla/5.0 (compatible; DriveBeat/1.0)",
      },
    });

    const contentType = apiRes.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = apiRes.headers.get("Content-Length");

    res.status(apiRes.status);
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentType.includes("audio/") || contentType.includes("video/")) {
      res.setHeader("Accept-Ranges", "bytes");
    }

    const data = await apiRes.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (err) {
    res.status(500).json({ error: "Proxy error", message: err.message });
  }
}
