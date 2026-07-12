import React from 'react';
import { ChevronLeft, ChevronRight, Fingerprint, Globe2, RotateCcw } from 'lucide-react';
import { pageSeed } from './passportArt';
import { PASSPORT_THEMES, type PassportAchievement, type PassportNationality, type StampStyle } from './passportData';
import { TopographyPaper, TravelStamp } from './PassportArtwork';

export interface PassportBookSettings {
  nationality: PassportNationality;
  stampStyle: StampStyle;
  seed: string;
  contours: number;
  roughness: number;
  inkBleed: number;
  pageCurl: number;
  speed: number;
  imperfections: boolean;
  topography: boolean;
}

interface PassportBookProps {
  spreads: PassportAchievement[][];
  settings: PassportBookSettings;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSpreadChange?: (spread: number) => void;
}

type Turn = { direction: 'next' | 'previous'; from: number; to: number };

const coverEmblemPaths: Record<string, React.ReactNode> = {
  eagle: <><path d="M50 22 40 35l-18-7 9 17-13 8 21 5 11 21 11-21 21-5-13-8 9-17-18 7-10-13Z" /><path d="M42 57h16M45 64h10" /></>,
  chrysanthemum: <>{Array.from({ length: 16 }, (_, index) => <ellipse key={`petal-${index}`} cx="50" cy="31" rx="5" ry="16" transform={`rotate(${index * 22.5} 50 50)`} />)}<circle cx="50" cy="50" r="9" /></>,
  lion: <><path d="M32 68c-7-21 2-40 18-44 17 4 25 23 18 44l-18 12-18-12Z" /><path d="M40 47c8-10 14-10 22 0M43 60h14M50 25v42" /></>,
  star: <><path d="m50 21 8 19 21 2-16 13 5 21-18-11-18 11 5-21-16-13 21-2 8-19Z" /><circle cx="50" cy="50" r="34" /></>,
  'southern-cross': <><path d="m50 18 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1 5-12Z" /><path d="m72 58 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z" /></>,
  chakra: <><circle cx="50" cy="50" r="28" /><circle cx="50" cy="50" r="6" />{Array.from({ length: 12 }, (_, index) => <path key={`spoke-${index}`} d="M50 22v22" transform={`rotate(${index * 30} 50 50)`} />)}</>,
};

const PassportCover: React.FC<{ nationality: PassportNationality; onOpen: () => void }> = ({ nationality, onOpen }) => {
  const theme = PASSPORT_THEMES[nationality];
  return (
    <button
      type="button"
      className="passport-cover"
      onClick={onOpen}
      style={{ '--cover': theme.cover, '--cover-dark': theme.coverDark, '--foil': theme.foil } as React.CSSProperties}
      aria-label={`Open ${theme.label} travel passport`}
    >
      <span className="passport-cover__edge" aria-hidden="true" />
      <span className="passport-cover__grain" aria-hidden="true" />
      <span className="passport-cover__country">{theme.label}</span>
      <svg className="passport-cover__emblem" viewBox="0 0 100 100" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {coverEmblemPaths[theme.emblem]}
        </g>
      </svg>
      <strong>Passport</strong>
      <span className="passport-cover__subtitle">Travel collection</span>
      <Fingerprint className="passport-cover__chip" aria-hidden="true" />
      <span className="passport-cover__code">{theme.countryCode}</span>
      <span className="passport-cover__hint">Tap to open</span>
    </button>
  );
};

interface BookPageProps {
  achievements: PassportAchievement[];
  pageNumber: number;
  side: 'left' | 'right';
  settings: PassportBookSettings;
}

const BookPage = React.memo<BookPageProps>(({ achievements, pageNumber, side, settings }) => (
  <section className={`passport-leaf passport-leaf--${side}`} aria-label={`Passport page ${pageNumber}`}>
    <TopographyPaper
      seed={pageSeed(settings.seed, pageNumber)}
      contours={settings.contours}
      roughness={settings.roughness}
      visible={settings.topography}
    />
    <span className="passport-leaf__wash" aria-hidden="true" />
    <header className="passport-leaf__header">
      <span>{side === 'left' ? 'Journeys & passages' : 'Places & wonders'}</span>
      <Globe2 size={12} aria-hidden="true" />
    </header>
    <div className="passport-leaf__stamps">
      {achievements.length > 0 ? achievements.map((achievement, index) => (
        <TravelStamp
          key={achievement.id}
          achievement={achievement}
          style={settings.stampStyle}
          inkBleed={settings.inkBleed}
          compact
          rotation={settings.imperfections ? ((pageNumber * 7 + index * 11) % 7) - 3 : 0}
        />
      )) : (
        <div className="passport-leaf__empty">
          <span>Open space</span>
          <p>The next journey leaves its mark here.</p>
        </div>
      )}
    </div>
    <footer className="passport-leaf__folio">
      <span>TRAVELFLOW · FIELD NOTES</span>
      <b>{String(pageNumber).padStart(2, '0')}</b>
    </footer>
  </section>
));
BookPage.displayName = 'BookPage';

const splitSpread = (spread: PassportAchievement[]) => ({ left: spread.slice(0, 6), right: spread.slice(6, 12) });

export const PassportBook: React.FC<PassportBookProps> = ({ spreads, settings, isOpen, onOpenChange, onSpreadChange }) => {
  const [spreadIndex, setSpreadIndex] = React.useState(0);
  const [turn, setTurn] = React.useState<Turn | null>(null);
  const safeIndex = Math.min(spreadIndex, Math.max(0, spreads.length - 1));
  const shownIndex = turn?.to ?? safeIndex;
  const shown = splitSpread(spreads[shownIndex] ?? []);
  const from = splitSpread(spreads[turn?.from ?? safeIndex] ?? []);
  const canPrevious = safeIndex > 0 && !turn;
  const canNext = safeIndex < spreads.length - 1 && !turn;

  const turnPage = (direction: 'next' | 'previous') => {
    if (turn) return;
    const next = direction === 'next' ? safeIndex + 1 : safeIndex - 1;
    if (next < 0 || next >= spreads.length) return;
    setTurn({ direction, from: safeIndex, to: next });
  };

  const completeTurn = () => {
    if (!turn) return;
    setSpreadIndex(turn.to);
    onSpreadChange?.(turn.to);
    setTurn(null);
  };

  const closeBook = () => {
    setTurn(null);
    setSpreadIndex(0);
    onOpenChange(false);
  };

  const bookStyle = {
    '--book-speed': `${Math.max(0.35, 1.35 - settings.speed * 0.15)}s`,
    '--page-curl': `${settings.pageCurl}px`,
  } as React.CSSProperties;

  return (
    <div className={`passport-object${isOpen ? ' passport-object--open' : ''}`} style={bookStyle}>
      {!isOpen ? <PassportCover nationality={settings.nationality} onOpen={() => onOpenChange(true)} /> : null}
      {isOpen ? (
        <div className="passport-book-wrap">
          <div className="passport-book" aria-label="Interactive travel passport">
            <span className="passport-book__back" aria-hidden="true" />
            <span className="passport-book__page-stack passport-book__page-stack--left" aria-hidden="true" />
            <span className="passport-book__page-stack passport-book__page-stack--right" aria-hidden="true" />
            <div className="passport-book__spread">
              <BookPage achievements={shown.left} pageNumber={shownIndex * 2 + 1} side="left" settings={settings} />
              <BookPage achievements={shown.right} pageNumber={shownIndex * 2 + 2} side="right" settings={settings} />
            </div>
            {turn ? (
              <div
                className={`passport-turn passport-turn--${turn.direction}`}
                onAnimationEnd={completeTurn}
                aria-hidden="true"
              >
                <div className="passport-turn__front">
                  <BookPage
                    achievements={turn.direction === 'next' ? from.right : from.left}
                    pageNumber={turn.from * 2 + (turn.direction === 'next' ? 2 : 1)}
                    side={turn.direction === 'next' ? 'right' : 'left'}
                    settings={settings}
                  />
                </div>
                <div className="passport-turn__back">
                  <BookPage
                    achievements={turn.direction === 'next' ? shown.left : shown.right}
                    pageNumber={turn.to * 2 + (turn.direction === 'next' ? 1 : 2)}
                    side={turn.direction === 'next' ? 'left' : 'right'}
                    settings={settings}
                  />
                </div>
              </div>
            ) : null}
            <span className="passport-book__seam" aria-hidden="true" />
          </div>
          <div className="passport-book__navigation">
            <button type="button" onClick={() => turnPage('previous')} disabled={!canPrevious} aria-label="Turn to previous passport spread">
              <ChevronLeft aria-hidden="true" />
            </button>
            <span>{safeIndex + 1} / {spreads.length}</span>
            <button type="button" onClick={() => turnPage('next')} disabled={!canNext} aria-label="Turn to next passport spread">
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" className="passport-book__close" onClick={closeBook}>
              <RotateCcw size={15} aria-hidden="true" /> Close book
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
