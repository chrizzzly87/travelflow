import * as React from 'react';

import { cn } from '@/lib/utils';
import '../../styles/travel-experience-system.css';

export type PlayfulDecisionTone = 'mango' | 'lagoon' | 'hibiscus' | 'orchid';

interface PlayfulDecisionVisualProps {
  tone: PlayfulDecisionTone;
  selected?: boolean;
  rotation?: number;
  scribble?: boolean;
}

type PlayfulDecisionStyle = React.CSSProperties & {
  '--tf-playful-rotation'?: string;
};

const buildVisualProps = ({
  tone,
  selected = false,
  rotation = 0,
  scribble = false,
}: PlayfulDecisionVisualProps) => ({
  'data-tone': tone,
  'data-selected': selected ? 'true' : 'false',
  'data-scribble': scribble ? 'true' : 'false',
  style: { '--tf-playful-rotation': `${rotation}deg` } as PlayfulDecisionStyle,
});

export interface PlayfulDecisionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'>,
    PlayfulDecisionVisualProps {
  style?: PlayfulDecisionStyle;
}

export const PlayfulDecisionButton = React.forwardRef<HTMLButtonElement, PlayfulDecisionButtonProps>(({
  className,
  selected = false,
  style,
  tone,
  rotation,
  scribble,
  type = 'button',
  ...props
}, ref) => {
  const visualProps = buildVisualProps({ tone, selected, rotation, scribble });
  return (
    <button
      ref={ref}
      type={type}
      className={cn('tf-playful-decision-card', className)}
      data-slot="playful-decision-button"
      data-interactive="true"
      aria-pressed={props['aria-pressed'] ?? selected}
      {...visualProps}
      {...props}
      style={{ ...visualProps.style, ...style }}
    />
  );
});

PlayfulDecisionButton.displayName = 'PlayfulDecisionButton';

export interface PlayfulDecisionSurfaceProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'style'>,
    PlayfulDecisionVisualProps {
  style?: PlayfulDecisionStyle;
}

export const PlayfulDecisionSurface = React.forwardRef<HTMLElement, PlayfulDecisionSurfaceProps>(({
  className,
  selected = false,
  style,
  tone,
  rotation,
  scribble,
  ...props
}, ref) => {
  const visualProps = buildVisualProps({ tone, selected, rotation, scribble });
  return (
    <article
      ref={ref}
      className={cn('tf-playful-decision-card', className)}
      data-slot="playful-decision-surface"
      {...visualProps}
      {...props}
      style={{ ...visualProps.style, ...style }}
    />
  );
});

PlayfulDecisionSurface.displayName = 'PlayfulDecisionSurface';
