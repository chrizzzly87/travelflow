import React from 'react';
import { ChevronLeft, ChevronRight, Globe2, RotateCcw } from 'lucide-react';
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

const PassportCover: React.FC<{ nationality: PassportNationality; onOpen: () => void }> = ({ nationality, onOpen }) => {
  const theme = PASSPORT_THEMES[nationality];
  return (
    <div className="passport-closed" style={{ '--cover': theme.cover, '--cover-dark': theme.coverDark, '--foil': theme.foil } as React.CSSProperties}>
      <span className="passport-closed__back" aria-hidden="true" />
      <span className="passport-closed__pages" aria-hidden="true" />
      <button type="button" className="passport-cover" onClick={onOpen} aria-label={`Open ${theme.label} travel passport`}>
        <span className="passport-cover__edge" aria-hidden="true" />
        <span className="passport-cover__grain" aria-hidden="true" />
        <span className="passport-cover__country">{theme.label}</span>
        <span className="passport-cover__seal" aria-hidden="true">{theme.countryCode}</span>
        <strong>Passport</strong>
        <svg className="passport-cover__biometric" viewBox="0 0 48 36" aria-hidden="true">
          <path d="M5 4h38v28H5zM18 4c-4 7-4 21 0 28M30 4c4 7 4 21 0 28M17 18h14" />
        </svg>
        <span className="passport-cover__code">{theme.countryCode}</span>
        <span className="passport-cover__hint">Tap to open</span>
      </button>
    </div>
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
  const theme = PASSPORT_THEMES[settings.nationality];
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
    '--cover': theme.cover,
    '--cover-dark': theme.coverDark,
    '--foil': theme.foil,
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
              <>
                <div className={`passport-stationary passport-stationary--${turn.direction}`} aria-hidden="true">
                  <BookPage
                    achievements={turn.direction === 'next' ? from.left : from.right}
                    pageNumber={turn.from * 2 + (turn.direction === 'next' ? 1 : 2)}
                    side={turn.direction === 'next' ? 'left' : 'right'}
                    settings={settings}
                  />
                </div>
                <div
                  className={`passport-turn passport-turn--${turn.direction}`}
                  onAnimationEnd={(event) => {
                    if (event.currentTarget === event.target) completeTurn();
                  }}
                  aria-hidden="true"
                >
                  <div className="passport-turn__front">
                    <BookPage achievements={turn.direction === 'next' ? from.right : from.left} pageNumber={turn.from * 2 + (turn.direction === 'next' ? 2 : 1)} side={turn.direction === 'next' ? 'right' : 'left'} settings={settings} />
                  </div>
                  <div className="passport-turn__back">
                    <BookPage achievements={turn.direction === 'next' ? shown.left : shown.right} pageNumber={turn.to * 2 + (turn.direction === 'next' ? 1 : 2)} side={turn.direction === 'next' ? 'left' : 'right'} settings={settings} />
                  </div>
                  <span className="passport-turn__edge" />
                </div>
              </>
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
