import { useState, useRef, useEffect } from "react";
import { Loader2, Link2, X } from "lucide-react";
import { extractFolderId, fetchFolderName, fetchAudioFiles, isApiKeyConfigured } from "../lib/drive";
import { saveFolder, saveTracks } from "../lib/storage";
import type { DriveFolder } from "../lib/drive";

interface FolderModalProps {
  onFolderAdded: (folder: DriveFolder) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export function FolderModal({ onFolderAdded, onClose, canClose = false }: FolderModalProps) {
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = link.trim();
    if (!trimmed) return;

    if (!isApiKeyConfigured()) {
      setErrorMsg("Google Drive API Key is not configured. Contact admin to set up the API Key.");
      setStatus("error");
      return;
    }

    const folderId = extractFolderId(trimmed);
    if (!folderId) {
      setErrorMsg("Invalid link. Please use a valid Google Drive folder link.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const [name, files] = await Promise.all([
        fetchFolderName(folderId),
        fetchAudioFiles(folderId),
      ]);

      if (files.length === 0) {
        setErrorMsg("This folder doesn't contain any audio files. Make sure the folder contains music and is publicly accessible.");
        setStatus("error");
        return;
      }

      const folder: DriveFolder = { id: folderId, name, link: trimmed };
      saveFolder(folder);
      saveTracks(folderId, files);
      onFolderAdded(folder);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch folder data.";
      const detail = msg.includes("|") ? msg.split("|")[1] : "";
      const statusCode = msg.includes("|") ? msg.split("|")[0] : msg;
      console.error("Drive error detail:", statusCode, detail);

      if (msg.includes("403") || msg.includes("401")) {
        setErrorMsg("Access denied. The Google Drive API Key doesn't have permission. Message: " + (detail || "The API Key may not be active or the folder is not public.") + " Make sure your folder is set to 'Anyone with the link can view.'");
      } else if (msg.includes("404")) {
        setErrorMsg("Folder not found. Please double-check the link you entered.");
      } else if (msg.includes("400") && msg.includes("API Key")) {
        setErrorMsg("Invalid API Key. Message: " + (detail || "The API Key may not be active."));
      } else {
        setErrorMsg("Failed to reach Google Drive. Message: " + (detail || msg));
      }
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && canClose && onClose) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm bg-[#0a0a0a] border border-border/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-base font-semibold tracking-tight">DriveBeat</h2>
            <p className="text-foreground/35 text-xs mt-0.5">Paste a Google Drive folder link</p>
          </div>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="text-foreground/30 transition-colors p-1 rounded-lg"
              data-testid="button-close-modal"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className={`flex items-center gap-2 bg-foreground/5 border rounded-xl px-3 py-2.5 transition-colors ${
          status === "error" ? "border-red-500/40" : "border-border/10 focus-within:border-border/25"
        }`}>
          <Link2 size={14} className="text-foreground/30 shrink-0" />
          <input
            ref={inputRef}
            type="url"
            value={link}
            onChange={(e) => { setLink(e.target.value); setStatus("idle"); setErrorMsg(""); }}
            onKeyDown={handleKeyDown}
            placeholder="https://drive.google.com/drive/folders/..."
            className="flex-1 bg-transparent text-foreground/80 text-sm placeholder:text-foreground/20 outline-none font-[Outfit]"
            data-testid="input-folder-link"
            disabled={status === "loading"}
          />
          {status === "loading" && <Loader2 size={14} className="text-foreground/40 shrink-0 animate-spin" />}
        </div>

        {errorMsg && (
          <p className="text-red-400/80 text-xs mt-2.5 leading-relaxed" data-testid="text-folder-error">
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !link.trim()}
          className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-all
            bg-white text-black active:bg-foreground/80
            disabled:bg-foreground/10 disabled:text-foreground/25 disabled:cursor-not-allowed"
          data-testid="button-load-folder"
        >
          {status === "loading" ? "Loading..." : "Load Music"}
        </button>

        <p className="text-foreground/20 text-xs text-center mt-3 leading-relaxed">
          Folder must be set to public to be accessible
        </p>
      </div>
    </div>
  );
}
