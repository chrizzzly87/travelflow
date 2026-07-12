import React from 'react';
import { Check, Dices, PanelRightClose, RotateCcw, Sparkles, Stamp } from 'lucide-react';
import { PassportBook, type PassportBookSettings } from './passport/PassportBook';
import { TravelStamp } from './passport/PassportArtwork';
import {
  FEATURED_STAMP_IDS,
  PASSPORT_ACHIEVEMENTS,
  PASSPORT_THEMES,
  STAMP_PROMPTS,
  STAMP_STYLE_LABELS,
  getAchievementById,
  getPassportSpreads,
  type PassportNationality,
  type StampStyle,
} from './passport/passportData';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import './passport/passport.css';

interface PlaygroundSettings extends PassportBookSettings {
  showLocked: boolean;
}

const DEFAULT_SETTINGS: PlaygroundSettings = {
  nationality: 'germany',
  stampStyle: 'postal',
  seed: 'wander-2026',
  contours: 16,
  roughness: 1.8,
  inkBleed: 0.7,
  pageCurl: 11,
  speed: 4,
  imperfections: true,
  topography: true,
  showLocked: true,
};

const SEED_PRESETS = [
  { value: 'wander-2026', label: 'Alpine field lines' },
  { value: 'island-notes', label: 'Island ridges' },
  { value: 'night-rail', label: 'Night rail valleys' },
  { value: 'atlas-no-7', label: 'Atlas no. 7' },
];

const SliderControl: React.FC<{
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onValueChange: (value: number) => void;
}> = ({ id, label, value, min, max, step, suffix = '', onValueChange }) => (
  <div className="passport-control">
    <div className="passport-control__label">
      <span id={`${id}-label`}>{label}</span>
      <output>{value}{suffix}</output>
    </div>
    <Slider
      aria-labelledby={`${id}-label`}
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(values) => onValueChange(values[0] ?? value)}
    />
  </div>
);

const ToggleControl: React.FC<{ id: string; label: string; detail: string; checked: boolean; onCheckedChange: (checked: boolean) => void }> = ({ id, label, detail, checked, onCheckedChange }) => (
  <div className="passport-toggle-row">
    <div>
      <label htmlFor={id}>{label}</label>
      <p>{detail}</p>
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const ControlPanel: React.FC<{
  settings: PlaygroundSettings;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSettingsChange: (settings: PlaygroundSettings) => void;
  onReset: () => void;
}> = ({ settings, prompt, onPromptChange, onSettingsChange, onReset }) => {
  const patchSettings = <K extends keyof PlaygroundSettings>(key: K, value: PlaygroundSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const randomizePaper = () => {
    const seeds = ['ridge', 'delta', 'fjord', 'moraine', 'archipelago'];
    const next = `${seeds[Math.floor(Math.random() * seeds.length)]}-${Math.floor(100 + Math.random() * 899)}`;
    patchSettings('seed', next);
  };

  return (
    <aside className="passport-controls" aria-label="Passport playground controls">
      <div className="passport-controls__heading">
        <div>
          <span>Component lab</span>
          <h2>Make it yours</h2>
        </div>
        <button type="button" onClick={onReset} aria-label="Reset all passport controls"><RotateCcw size={16} /></button>
      </div>

      <section className="passport-controls__section">
        <h3>Cover & collection</h3>
        <div className="passport-field">
          <label htmlFor="passport-nationality">Passport nationality</label>
          <Select value={settings.nationality} onValueChange={(value) => patchSettings('nationality', value as PassportNationality)}>
            <SelectTrigger id="passport-nationality"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PASSPORT_THEMES).map(([value, theme]) => <SelectItem key={value} value={value}>{theme.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="passport-field">
          <label htmlFor="passport-stamp-style">Stamp language</label>
          <Select value={settings.stampStyle} onValueChange={(value) => patchSettings('stampStyle', value as StampStyle)}>
            <SelectTrigger id="passport-stamp-style"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STAMP_STYLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ToggleControl id="show-locked" label="Show future stamps" detail="Leave clues for achievements still ahead." checked={settings.showLocked} onCheckedChange={(checked) => patchSettings('showLocked', checked)} />
      </section>

      <section className="passport-controls__section">
        <div className="passport-controls__section-title">
          <h3>Paper terrain</h3>
          <button type="button" onClick={randomizePaper}><Dices size={15} /> New map</button>
        </div>
        <div className="passport-field">
          <label htmlFor="passport-paper-seed">Terrain family</label>
          <Select value={SEED_PRESETS.some((preset) => preset.value === settings.seed) ? settings.seed : 'custom'} onValueChange={(value) => value !== 'custom' && patchSettings('seed', value)}>
            <SelectTrigger id="passport-paper-seed"><SelectValue placeholder="Custom terrain" /></SelectTrigger>
            <SelectContent>
              {SEED_PRESETS.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}
              {!SEED_PRESETS.some((preset) => preset.value === settings.seed) ? <SelectItem value="custom">Custom · {settings.seed}</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <SliderControl id="contours" label="Contour density" value={settings.contours} min={8} max={24} step={1} onValueChange={(value) => patchSettings('contours', value)} />
        <SliderControl id="roughness" label="Line wander" value={settings.roughness} min={0} max={4} step={0.1} onValueChange={(value) => patchSettings('roughness', value)} />
        <ToggleControl id="topography" label="Topography" detail="Hash-generated contour art on every leaf." checked={settings.topography} onCheckedChange={(checked) => patchSettings('topography', checked)} />
      </section>

      <section className="passport-controls__section">
        <h3>Object physics</h3>
        <SliderControl id="page-curl" label="Page curl" value={settings.pageCurl} min={0} max={20} step={1} suffix="px" onValueChange={(value) => patchSettings('pageCurl', value)} />
        <SliderControl id="turn-speed" label="Turn energy" value={settings.speed} min={1} max={6} step={1} onValueChange={(value) => patchSettings('speed', value)} />
        <SliderControl id="ink-bleed" label="Ink bleed" value={settings.inkBleed} min={0} max={2} step={0.1} suffix="px" onValueChange={(value) => patchSettings('inkBleed', value)} />
        <ToggleControl id="imperfections" label="Human placement" detail="Small rotations keep every spread collected, not computed." checked={settings.imperfections} onCheckedChange={(checked) => patchSettings('imperfections', checked)} />
      </section>

      <section className="passport-controls__section passport-controls__prompt">
        <div className="passport-controls__section-title">
          <h3>Vector prompt recipe</h3>
          <Sparkles size={15} aria-hidden="true" />
        </div>
        <textarea aria-label="Stamp generation prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} rows={6} />
        <p>Ready for a vector-capable model such as Quiver. This prototype renders locally, so no API key is exposed or required.</p>
      </section>
    </aside>
  );
};

export const PassportPlaygroundPage: React.FC = () => {
  const [settings, setSettings] = React.useState<PlaygroundSettings>(DEFAULT_SETTINGS);
  const [isOpen, setIsOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState(() => STAMP_PROMPTS[DEFAULT_SETTINGS.stampStyle].replace('{place}', 'Kyoto, Japan'));
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const spreads = React.useMemo(() => getPassportSpreads(settings.showLocked), [settings.showLocked]);
  const unlockedCount = PASSPORT_ACHIEVEMENTS.filter((achievement) => achievement.unlocked).length;
  const featured = FEATURED_STAMP_IDS.flatMap((id) => {
    const achievement = getAchievementById(id);
    return achievement ? [achievement] : [];
  });

  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Passport Playground · TravelFlow';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const updateSettings = (next: PlaygroundSettings) => {
    if (next.stampStyle !== settings.stampStyle) {
      setPrompt(STAMP_PROMPTS[next.stampStyle].replace('{place}', 'Kyoto, Japan'));
    }
    setSettings(next);
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    setPrompt(STAMP_PROMPTS[DEFAULT_SETTINGS.stampStyle].replace('{place}', 'Kyoto, Japan'));
    setIsOpen(false);
  };

  return (
    <main className="passport-playground" dir="ltr" data-tf-handoff-ready="true">
      <div className="passport-playground__grain" aria-hidden="true" />
      <header className="passport-playground__intro">
        <div className="passport-playground__eyebrow"><Stamp size={15} aria-hidden="true" /> TravelFlow specimen no. 01</div>
        <h1>A life, <em>well stamped.</em></h1>
        <p>A tactile travel record where cities, crossings, rituals, and wonders become small pieces of personal history.</p>
        <div className="passport-playground__ledger" aria-label={`${unlockedCount} of ${PASSPORT_ACHIEVEMENTS.length} example achievements unlocked`}>
          <span><b>{unlockedCount}</b> collected</span>
          <span><b>{PASSPORT_ACHIEVEMENTS.length}</b> designed</span>
          <span><b>3</b> art directions</span>
        </div>
      </header>

      <button type="button" className="passport-controls-trigger" onClick={() => setControlsOpen((open) => !open)} aria-expanded={controlsOpen}>
        <PanelRightClose size={17} aria-hidden="true" /> {controlsOpen ? 'Hide controls' : 'Tune passport'}
      </button>

      <div className={`passport-playground__workspace${controlsOpen ? ' passport-playground__workspace--controls-open' : ''}`}>
        <section className="passport-stage" aria-label="Passport preview">
          <div className="passport-stage__caption">
            <span>{PASSPORT_THEMES[settings.nationality].countryCode} · PERSONAL ARCHIVE</span>
            <span>{isOpen ? 'Turn the leaves' : 'Open the cover'}</span>
          </div>
          <PassportBook spreads={spreads} settings={settings} isOpen={isOpen} onOpenChange={setIsOpen} />
          {!isOpen ? <p className="passport-stage__instruction"><Check size={14} aria-hidden="true" /> Cover selected from traveler nationality</p> : null}
        </section>
        <div className={`passport-controls-shell${controlsOpen ? ' passport-controls-shell--open' : ''}`}>
          <ControlPanel settings={settings} prompt={prompt} onPromptChange={setPrompt} onSettingsChange={updateSettings} onReset={reset} />
        </div>
      </div>

      <section className="passport-style-study" aria-labelledby="style-study-title">
        <div className="passport-section-heading">
          <span>Art direction test</span>
          <h2 id="style-study-title">Three places, three visual languages.</h2>
          <p>The subjects stay fixed so the difference comes from the treatment—not the destination.</p>
        </div>
        <div className="passport-style-study__table">
          {(['postal', 'visa', 'engraved'] as StampStyle[]).map((style) => (
            <section key={style} className="passport-style-row">
              <header>
                <strong>{STAMP_STYLE_LABELS[style]}</strong>
                <span>{style === 'postal' ? 'Bold · collectible' : style === 'visa' ? 'Quiet · authentic' : 'Detailed · archival'}</span>
              </header>
              <div>
                {featured.map((achievement, index) => <TravelStamp key={`${style}-${achievement.id}`} achievement={achievement} style={style} inkBleed={settings.inkBleed} rotation={index - 1} />)}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="passport-achievement-system" aria-labelledby="achievement-title">
        <div className="passport-section-heading">
          <span>Achievement system · {PASSPORT_ACHIEVEMENTS.length} specimens</span>
          <h2 id="achievement-title">A collection with a reason to grow.</h2>
          <p>Achievements mix concrete places with repeatable travel behaviors, creating both aspiration and a record of how someone travels.</p>
        </div>
        <div className="passport-achievement-system__legend">
          <span><i className="is-earned" /> Earned</span>
          <span><i /> Future discovery</span>
          <span>Values range from 75–300 field points</span>
        </div>
        <div className="passport-achievement-grid">
          {PASSPORT_ACHIEVEMENTS.map((achievement, index) => (
            <div key={achievement.id} className="passport-achievement-card">
              <TravelStamp achievement={achievement} style={settings.stampStyle} inkBleed={settings.inkBleed} compact rotation={settings.imperfections ? (index % 5) - 2 : 0} />
              <p>{achievement.detail}</p>
              <span>{achievement.category}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="passport-playground__footer">
        <span>Hidden playground · not connected to profiles yet</span>
        <span>Every contour is deterministic from its page hash</span>
      </footer>
    </main>
  );
};

export default PassportPlaygroundPage;
