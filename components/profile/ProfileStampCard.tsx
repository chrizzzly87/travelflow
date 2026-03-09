import React from "react";
import { LockSimple, SealCheck } from "@phosphor-icons/react";
import type { ProfileStampProgress } from "./profileStamps";

interface ProfileStampCardProps {
  stamp: ProfileStampProgress;
  selected?: boolean;
  onSelect?: (stamp: ProfileStampProgress) => void;
  onHover?: (stamp: ProfileStampProgress) => void;
  locale?: string;
  unlockedOnLabel?: string;
  compact?: boolean;
}

const getStableRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647;
};

export const ProfileStampCard: React.FC<ProfileStampCardProps> = ({
  stamp,
  selected = false,
  onSelect,
  onHover,
  locale = "en",
  unlockedOnLabel = "Unlocked",
  compact = false,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const randomRotate = React.useMemo(
    () => -3 + getStableRandom(stamp.definition.id + "r") * 6,
    [stamp.definition.id],
  );
  const randomTranslateX = React.useMemo(
    () => -2.5 + getStableRandom(stamp.definition.id + "x") * 5,
    [stamp.definition.id],
  );
  const randomTranslateY = React.useMemo(
    () => -2.5 + getStableRandom(stamp.definition.id + "y") * 5,
    [stamp.definition.id],
  );

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return (
    <button
      type="button"
      onPointerEnter={() => {
        setIsHovered(true);
        onHover?.(stamp);
      }}
      onPointerLeave={() => {
        setIsHovered(false);
      }}
      onClick={() => {
        if (onSelect) {
          onSelect(stamp);
        }
      }}
      className={[
        "profile-stamp-card group relative flex aspect-square flex-col overflow-hidden rounded-xl border bg-white p-3 text-left shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md",
        selected
          ? "border-accent-300 shadow-md shadow-accent-100/60"
          : "border-slate-200 hover:border-slate-300",
        stamp.achieved
          ? ""
          : "opacity-85 saturate-50 hover:saturate-100 hover:opacity-100",
      ].join(" ")}
      style={
        {
          "--stamp-base-rotate": `${prefersReducedMotion ? 0 : randomRotate}deg`,
          "--stamp-base-x": `${prefersReducedMotion ? 0 : randomTranslateX}px`,
          "--stamp-base-y": `${prefersReducedMotion ? 0 : randomTranslateY}px`,
        } as React.CSSProperties
      }
      aria-pressed={selected}
    >
      <div
        className={`relative flex-1 w-full flex items-center justify-center overflow-hidden rounded-lg bg-slate-50 transition-colors group-hover:bg-slate-100`}
      >
        <div className="relative h-4/5 w-4/5">
          <img
            src={stamp.definition.assetPath}
            alt={stamp.definition.title}
            className="h-full w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center text-center space-y-0.5">
        <p className="line-clamp-1 text-xs font-bold text-slate-800">
          {stamp.definition.title}
        </p>
        <span className="text-[10px] font-medium text-slate-500">
          {stamp.definition.rarityPercent}% Rarity
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-slate-900/90 p-4 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100"
        aria-hidden="true"
      >
        <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-200">
          {stamp.definition.subtitle}
        </p>
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-100">
            <span className="flex items-center gap-1.5">
              {stamp.achieved ? (
                <SealCheck
                  size={14}
                  weight="duotone"
                  className="text-emerald-400"
                />
              ) : (
                <LockSimple
                  size={14}
                  weight="duotone"
                  className="text-slate-400"
                />
              )}
              {stamp.achieved ? "Unlocked" : "Locked"}
            </span>
            <span>
              {Math.floor(stamp.currentValue)} / {stamp.targetValue}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
