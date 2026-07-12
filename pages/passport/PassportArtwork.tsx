import React from 'react';
import { LockKeyhole } from 'lucide-react';
import type { PassportAchievement, StampMotif, StampStyle } from './passportData';
import { generateTopographyPaths } from './passportArt';

interface TopographyPaperProps {
  seed: string;
  contours: number;
  roughness: number;
  visible: boolean;
}

export const TopographyPaper = React.memo<TopographyPaperProps>(({ seed, contours, roughness, visible }) => {
  const paths = React.useMemo(
    () => generateTopographyPaths({ seed, contours, roughness }),
    [contours, roughness, seed],
  );

  if (!visible) return null;
  return (
    <svg className="passport-topography" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g>
        {paths.map((path, index) => <path key={`${seed}-${index}`} d={path} />)}
      </g>
    </svg>
  );
});
TopographyPaper.displayName = 'TopographyPaper';

const MotifArtwork: React.FC<{ motif: StampMotif }> = ({ motif }) => {
  switch (motif) {
    case 'mountain':
      return <path d="M17 67 42 33l12 17 12-23 27 40H17Zm25-34 7 10-7 3-6-4 6-9Zm24-6 8 12-8 4-7-5 7-11Z" />;
    case 'tower':
      return <path d="M46 19h18l-4 10 5 38 10 12H35l10-12 5-38-4-10Zm2 31h14M42 65h26M48 29h14" />;
    case 'bridge':
      return <path d="M18 68h74M27 68V43m56 25V43M23 45h64M30 45c10 0 10 15 20 15s10-15 20-15 10 15 17 15M23 51 17 68m70-17 6 17" />;
    case 'temple':
      return <path d="m22 42 33-19 33 19H22Zm8 4h50M35 46v25m40-25v25M26 73h58M40 38h30M48 23v-7h14v7" />;
    case 'coast':
      return <path d="M18 62c11-12 22-12 33 0s22 12 41 0M18 73c11-12 22-12 33 0s22 12 41 0M42 54l13-30 13 30H42Zm13-30v30" />;
    case 'compass':
      return <path d="M55 18 68 51 55 84 42 51 55 18Zm0 15v36M37 51h36m-18-8 7 8-7 8-7-8 7-8Z" />;
    case 'train':
      return <path d="M28 23h54v45H28V23Zm8 8h38v17H36V31Zm2 37-8 12m40-12 8 12M40 58h3m24 0h3M23 80h64M18 38h10m54 0h10" />;
    case 'food':
      return <path d="M32 21v26c0 9 7 16 16 16h14c9 0 16-7 16-16V21M32 33h46M48 63v17m14-17v17M40 80h30M87 22v58m-6-47h12" />;
    case 'globe':
      return <path d="M55 19a34 34 0 1 1 0 68 34 34 0 0 1 0-68Zm0 0c12 10 17 21 17 34S67 77 55 87c-12-10-17-21-17-34s5-24 17-34ZM23 53h64M29 37h52M29 69h52" />;
    case 'monument':
      return <path d="M27 75h56M34 67h42M39 33h32v34H39V33Zm-7-8h46l-23-9-23 9Zm14 17h18v25H46V42Z" />;
    default:
      return null;
  }
};

interface TravelStampProps {
  achievement: PassportAchievement;
  style: StampStyle;
  inkBleed: number;
  compact?: boolean;
  rotation?: number;
}

export const TravelStamp = React.memo<TravelStampProps>(({ achievement, style, inkBleed, compact = false, rotation = 0 }) => {
  const locked = !achievement.unlocked;
  return (
    <article
      className={`travel-stamp travel-stamp--${style}${locked ? ' travel-stamp--locked' : ''}${compact ? ' travel-stamp--compact' : ''}`}
      style={{
        '--stamp-color': achievement.color,
        '--stamp-accent': achievement.accent,
        '--stamp-bleed': `${inkBleed}px`,
        '--stamp-rotation': `${rotation}deg`,
      } as React.CSSProperties}
      aria-label={`${achievement.title}, ${achievement.place}${locked ? ', locked' : ''}`}
    >
      <div className="travel-stamp__paper">
        <span className="travel-stamp__edition">TF · {achievement.points}</span>
        <svg className="travel-stamp__art" viewBox="0 0 110 100" aria-hidden="true">
          <g fill={style === 'postal' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={style === 'engraved' ? 1.25 : 2.4} strokeLinecap="round" strokeLinejoin="round">
            <MotifArtwork motif={achievement.motif} />
          </g>
          {style === 'engraved' ? (
            <g className="travel-stamp__hatch" stroke="currentColor" strokeWidth=".55" opacity=".45">
              {Array.from({ length: 11 }, (_, index) => (
                <path key={`hatch-${index}`} d={`M${10 + index * 9} 14 ${2 + index * 9} 88`} />
              ))}
            </g>
          ) : null}
        </svg>
        <div className="travel-stamp__copy">
          <strong>{achievement.title}</strong>
          <span>{achievement.place}</span>
          {achievement.earnedOn ? <time>{achievement.earnedOn}</time> : <time>NOT YET ISSUED</time>}
        </div>
        {locked ? (
          <span className="travel-stamp__lock" aria-hidden="true"><LockKeyhole size={compact ? 14 : 18} /></span>
        ) : null}
      </div>
    </article>
  );
});
TravelStamp.displayName = 'TravelStamp';
