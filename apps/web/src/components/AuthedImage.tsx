import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api-client";

interface AuthedImageProps {
  src: string;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
}

export function AuthedImage({ src, alt, className, fit = "cover" }: AuthedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setObjectUrl(null);
    setError(false);

    api
      .getBlob(src)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
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
      <div className={`flex items-center justify-center bg-surface border border-line rounded-[10px] text-xs text-ink-soft ${className ?? ""}`}>
        Image indisponible
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={`animate-pulse bg-surface border border-line rounded-[10px] ${className ?? ""}`} />;
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`${fit === "contain" ? "object-contain" : "object-cover"} rounded-[10px] ${className ?? ""}`}
    />
  );
}
