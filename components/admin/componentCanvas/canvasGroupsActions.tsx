import React, { useState } from 'react';
import { ArrowRight, Check, MapTrifold, Plus, Sparkle, Trash } from '@phosphor-icons/react';

import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '../../ui/button-group';
import { Input } from '../../ui/input';
import { Kbd } from '../../ui/kbd';
import { Separator } from '../../ui/separator';
import { Spinner } from '../../ui/spinner';
import type { CanvasGroupDefinition } from './ComponentCanvas';
import { CanvasRow, CanvasRows, CanvasSlot } from './canvasFrame';
import { BADGE_VARIANTS, BUTTON_GROUP_ORIENTATIONS, BUTTON_ICON_SIZES, BUTTON_TEXT_SIZES, BUTTON_VARIANTS } from './canvasCatalog';

/** `toggle` and `floating` announce their state through aria-pressed; the rest ignore it. */
const PressableButton: React.FC<{ variant: 'toggle' | 'floating' }> = ({ variant }) => {
    const [pressed, setPressed] = useState(false);
    return (
        <Button variant={variant} aria-pressed={pressed} onClick={() => setPressed((value) => !value)}>
            Continue
        </Button>
    );
};

const ButtonContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="variant" minSlotWidth={150}>
            {BUTTON_VARIANTS.map((variant) => (
                <CanvasSlot key={variant} label={variant}>
                    {variant === 'toggle' || variant === 'floating'
                        ? <PressableButton variant={variant} />
                        : <Button variant={variant}>Continue</Button>}
                </CanvasSlot>
            ))}
        </CanvasRow>

        <CanvasRow title="size" minSlotWidth={150}>
            {BUTTON_TEXT_SIZES.map((size) => (
                <CanvasSlot key={size} label={size}>
                    <Button size={size}>Continue</Button>
                </CanvasSlot>
            ))}
        </CanvasRow>

        <CanvasRow title="icon size" minSlotWidth={150}>
            {BUTTON_ICON_SIZES.map((size) => (
                <CanvasSlot key={size} label={size}>
                    <Button size={size} variant="outline" aria-label="Add">
                        <Plus />
                    </Button>
                </CanvasSlot>
            ))}
        </CanvasRow>

        <CanvasRow title="state" minSlotWidth={150}>
            <CanvasSlot label="enabled">
                <Button>Continue</Button>
            </CanvasSlot>
            <CanvasSlot label="disabled">
                <Button disabled>Continue</Button>
            </CanvasSlot>
            <CanvasSlot label="loading">
                <Button loading>Continue</Button>
            </CanvasSlot>
            <CanvasSlot label="aria-invalid">
                <Button variant="outline" aria-invalid>Continue</Button>
            </CanvasSlot>
        </CanvasRow>

        <CanvasRow title="content" minSlotWidth={150}>
            <CanvasSlot label="icon">
                <Button icon={<Sparkle />}>Continue</Button>
            </CanvasSlot>
            <CanvasSlot label="trailing icon">
                <Button>Continue <ArrowRight /></Button>
            </CanvasSlot>
            <CanvasSlot label="shortcut">
                <Button shortcut="⌘↵" aria-keyshortcuts="Meta+Enter">Continue</Button>
            </CanvasSlot>
            <CanvasSlot label="asChild link">
                <Button asChild>
                    <a href="#canvas-group-badge">Continue</a>
                </Button>
            </CanvasSlot>
        </CanvasRow>

        <CanvasRow title="pressed state (floating, toggle)" minSlotWidth={150}>
            <CanvasSlot label="floating · off">
                <Button variant="floating" size="icon" aria-label="Show map" aria-pressed={false}><MapTrifold /></Button>
            </CanvasSlot>
            <CanvasSlot label="floating · pressed">
                <Button variant="floating" size="icon" aria-label="Show map" aria-pressed><MapTrifold /></Button>
            </CanvasSlot>
            <CanvasSlot label="floating · expanded">
                <Button variant="floating" size="icon" aria-label="Show map" aria-expanded><MapTrifold /></Button>
            </CanvasSlot>
            <CanvasSlot label="toggle · pressed">
                <Button variant="toggle" aria-pressed>Continue</Button>
            </CanvasSlot>
        </CanvasRow>

        <CanvasRow title="social provider" minSlotWidth={220}>
            {(['google', 'facebook', 'kakao'] as const).map((provider) => (
                <CanvasSlot key={provider} label={`data-provider=${provider}`}>
                    <Button variant="social" size="lg" data-provider={provider} className="w-full">Continue</Button>
                </CanvasSlot>
            ))}
            <CanvasSlot label="data-last-used">
                <Button variant="social" size="lg" data-provider="google" data-last-used="true" className="w-full">Continue</Button>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

const ButtonGroupContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="orientation" minSlotWidth={260}>
            {BUTTON_GROUP_ORIENTATIONS.map((orientation) => (
                <CanvasSlot key={orientation} label={orientation}>
                    <ButtonGroup orientation={orientation} aria-label="Day actions">
                        <Button variant="outline">Copy</Button>
                        <Button variant="outline">Move</Button>
                        <Button variant="outline">Delete</Button>
                    </ButtonGroup>
                </CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="composition" minSlotWidth={260}>
            <CanvasSlot label="with ButtonGroupText">
                <ButtonGroup aria-label="Nights">
                    <ButtonGroupText>Nights</ButtonGroupText>
                    <Button variant="outline">Copy</Button>
                    <Button variant="outline">Move</Button>
                </ButtonGroup>
            </CanvasSlot>
            <CanvasSlot label="with ButtonGroupSeparator">
                <ButtonGroup aria-label="Day actions">
                    <Button variant="secondary">Copy</Button>
                    <ButtonGroupSeparator />
                    <Button variant="secondary">Move</Button>
                </ButtonGroup>
            </CanvasSlot>
            <CanvasSlot label="nested groups">
                <ButtonGroup aria-label="Day actions">
                    <ButtonGroup>
                        <Button variant="outline">Copy</Button>
                        <Button variant="outline">Move</Button>
                    </ButtonGroup>
                    <ButtonGroup>
                        <Button variant="outline" size="icon" aria-label="Delete"><Trash /></Button>
                    </ButtonGroup>
                </ButtonGroup>
            </CanvasSlot>
            <CanvasSlot label="with input">
                <ButtonGroup aria-label="Invite">
                    <Input aria-label="Email" placeholder="ana@example.com" className="h-9" />
                    <Button variant="outline">Invite</Button>
                </ButtonGroup>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

const BadgeContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="variant" minSlotWidth={130}>
            {BADGE_VARIANTS.map((variant) => (
                <CanvasSlot key={variant} label={variant}>
                    <Badge variant={variant}>Pro plan</Badge>
                </CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={130}>
            <CanvasSlot label="text">
                <Badge variant="success">Pro plan</Badge>
            </CanvasSlot>
            <CanvasSlot label="icon">
                <Badge variant="success"><Check />Pro plan</Badge>
            </CanvasSlot>
            <CanvasSlot label="asChild link">
                <Badge variant="success" asChild>
                    <a href="#canvas-group-button">Pro plan</a>
                </Badge>
            </CanvasSlot>
            <CanvasSlot label="link leaving canvas">
                <Badge variant="success" asChild>
                    <a href="/pricing">Pro plan</a>
                </Badge>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

const KbdContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="context" minSlotWidth={170}>
            <CanvasSlot label="plain text">
                <span className="text-sm text-foreground">Press <Kbd>⌘K</Kbd> to search</span>
            </CanvasSlot>
            <CanvasSlot label="Button shortcut · default">
                <Button shortcut="⌘K">Search</Button>
            </CanvasSlot>
            <CanvasSlot label="Button shortcut · ghost">
                <Button variant="ghost" shortcut="⌘K">Search</Button>
            </CanvasSlot>
            <CanvasSlot label="Button shortcut · outline">
                <Button variant="outline" shortcut="⌘K">Search</Button>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

const SpinnerContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="context" minSlotWidth={170}>
            <CanvasSlot label="standalone">
                <Spinner />
            </CanvasSlot>
            <CanvasSlot label="inline with text">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Saving trip</span>
            </CanvasSlot>
            <CanvasSlot label="Button loading">
                <Button loading>Save trip</Button>
            </CanvasSlot>
            <CanvasSlot label="Button loading · outline">
                <Button variant="outline" loading>Save trip</Button>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

const SeparatorContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="orientation" minSlotWidth={260}>
            <CanvasSlot label="horizontal">
                <div className="flex w-full flex-col gap-3 text-sm text-foreground">
                    <span>Lisbon</span>
                    <Separator orientation="horizontal" />
                    <span>Porto</span>
                </div>
            </CanvasSlot>
            <CanvasSlot label="vertical">
                <div className="flex h-6 items-center gap-3 text-sm text-foreground">
                    <span>Lisbon</span>
                    <Separator orientation="vertical" />
                    <span>Porto</span>
                </div>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

export const ACTION_GROUPS: CanvasGroupDefinition[] = [
    { id: 'button', title: 'Button', render: () => <ButtonContent /> },
    { id: 'button-group', title: 'ButtonGroup', render: () => <ButtonGroupContent /> },
    { id: 'badge', title: 'Badge', render: () => <BadgeContent /> },
    { id: 'kbd', title: 'Kbd', render: () => <KbdContent /> },
    { id: 'spinner', title: 'Spinner', render: () => <SpinnerContent /> },
    { id: 'separator', title: 'Separator', render: () => <SeparatorContent /> },
];
