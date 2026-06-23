import { useState, useRef, useEffect } from "react";
import { Loader2, Link2, X } from "lucide-react";
import { extractFolderId, fetchFolderName, fetchAudioFiles } from "../lib/drive";
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

    const folderId = extractFolderId(trimmed);
    if (!folderId) {
      setErrorMsg("Link tidak valid. Gunakan link Google Drive folder yang benar.");
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
        setErrorMsg("Folder ini tidak berisi file audio. Pastikan folder berisi musik dan dapat diakses publik.");
        setStatus("error");
        return;
      }

      const folder: DriveFolder = { id: folderId, name, link: trimmed };
      saveFolder(folder);
      saveTracks(folderId, files);
      onFolderAdded(folder);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal mengambil data folder.";
      setErrorMsg(msg.includes("403") || msg.includes("401")
        ? "Akses ditolak. Pastikan folder disetel ke 'Siapa saja yang memiliki link' dapat melihat."
        : msg.includes("404")
        ? "Folder tidak ditemukan. Periksa kembali link yang dimasukkan."
        : "Gagal menghubungi Google Drive. Periksa API Key dan koneksi internet.");
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-base font-semibold tracking-tight">DriveBeat</h2>
            <p className="text-white/35 text-xs mt-0.5">Tempel link folder Google Drive</p>
          </div>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg"
              data-testid="button-close-modal"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className={`flex items-center gap-2 bg-white/5 border rounded-xl px-3 py-2.5 transition-colors ${
          status === "error" ? "border-red-500/40" : "border-white/10 focus-within:border-white/25"
        }`}>
          <Link2 size={14} className="text-white/30 shrink-0" />
          <input
            ref={inputRef}
            type="url"
            value={link}
            onChange={(e) => { setLink(e.target.value); setStatus("idle"); setErrorMsg(""); }}
            onKeyDown={handleKeyDown}
            placeholder="https://drive.google.com/drive/folders/..."
            className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/20 outline-none font-[Outfit]"
            data-testid="input-folder-link"
            disabled={status === "loading"}
          />
          {status === "loading" && <Loader2 size={14} className="text-white/40 shrink-0 animate-spin" />}
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
            bg-white text-black hover:bg-white/90 active:bg-white/80
            disabled:bg-white/10 disabled:text-white/25 disabled:cursor-not-allowed"
          data-testid="button-load-folder"
        >
          {status === "loading" ? "Memuat..." : "Muat Musik"}
        </button>

        <p className="text-white/20 text-xs text-center mt-3 leading-relaxed">
          Folder harus disetel publik agar dapat diakses
        </p>
      </div>
    </div>
  );
}
