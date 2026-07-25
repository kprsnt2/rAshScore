"use client";

import { useState } from "react";
import { getBrandLogoUrl } from "@/lib/brand-logos";

interface BrandLogoProps {
  brand: string;
  size?: number;
  className?: string;
  /** Index used for fallback avatar color (optional) */
  rank?: number;
}

const AVATAR_COLORS = [
  "bg-yellow-500/10 text-yellow-500",
  "bg-gray-400/10 text-gray-400",
  "bg-orange-500/10 text-orange-400",
  "bg-primary-500/10 text-primary-400",
  "bg-purple-500/10 text-purple-400",
  "bg-cyan-500/10 text-cyan-400",
  "bg-pink-500/10 text-pink-400",
  "bg-emerald-500/10 text-emerald-400",
  "bg-blue-500/10 text-blue-400",
  "bg-rose-500/10 text-rose-400",
];

/**
 * Renders a brand logo fetched via logo.dev API,
 * with a graceful fallback to a styled initial-letter avatar.
 */
export default function BrandLogo({ brand, size = 24, className = "", rank }: BrandLogoProps) {
  // Always fetch the largest available favicon (128px) so it stays crisp
  const logoUrl = getBrandLogoUrl(brand, 128);
  const [imgError, setImgError] = useState(false);

  const sizeClass =
    size <= 20 ? "w-5 h-5" :
    size <= 24 ? "w-6 h-6" :
    size <= 28 ? "w-7 h-7" :
    size <= 32 ? "w-8 h-8" :
    size <= 40 ? "w-10 h-10" :
    "w-12 h-12";

  const textSize =
    size <= 20 ? "text-[9px]" :
    size <= 24 ? "text-[10px]" :
    size <= 32 ? "text-xs" :
    "text-sm";

  // Determine avatar color based on rank or brand name hash
  const colorIndex = rank !== undefined
    ? rank % AVATAR_COLORS.length
    : brand.charCodeAt(0) % AVATAR_COLORS.length;

  // Show fallback avatar if no URL or image failed to load
  if (!logoUrl || imgError) {
    return (
      <div
        className={`${sizeClass} rounded-md flex-shrink-0 flex items-center justify-center ${textSize} font-bold ${AVATAR_COLORS[colorIndex]} ${className}`}
        aria-hidden="true"
      >
        {brand.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${brand} logo`}
      className={`${sizeClass} rounded-md flex-shrink-0 object-contain ${className}`}
      loading="lazy"
      onError={() => setImgError(true)}
    />
  );
}
