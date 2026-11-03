import { useState } from "react";

/** Official car render (ADR 0006), decorative; hidden when absent or broken. */
export function CarImage({
  url,
  className = "",
}: {
  url: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
      }}
      className={`object-contain ${className}`}
    />
  );
}
