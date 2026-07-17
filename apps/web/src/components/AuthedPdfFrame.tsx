import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api-client";

interface AuthedPdfFrameProps {
  src: string;
}

export function AuthedPdfFrame({ src }: AuthedPdfFrameProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setBlobUrl(null);
    setError(false);

    api
      .getBlob(src)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError || err instanceof Error);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-surface border border-line rounded-[14px] text-xs text-ink-soft p-6 mb-4">
        Impossible de charger le PDF.
      </div>
    );
  }

  if (!blobUrl) {
    return <div className="animate-pulse bg-surface border border-line rounded-[14px] min-h-[400px] mb-4" style={{ height: "60vh" }} />;
  }

  return (
    <div className="mb-4">
      <iframe
        src={blobUrl}
        title="Énoncé PDF"
        className="w-full min-h-[400px] rounded-[14px] border border-line"
        style={{ height: "60vh" }}
      />
      <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-ink-soft underline mt-2">
        Ouvrir dans un nouvel onglet
      </a>
    </div>
  );
}
