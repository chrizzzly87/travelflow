import React, { useState } from 'react';
import { CaretUpDown, Gear, Info, MapPin, Warning } from '@phosphor-icons/react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { AnimatedNumber } from '../../ui/animated-number';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { SettingsCard, SettingsGroup, SettingsPanel, SettingsRow, SettingsSection } from '../../ui/settings-panel';
import { SplitFlap } from '../../ui/SplitFlap';
import { Switch } from '../../ui/switch';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { TodayBadge } from '../../ui/today-badge';
import type { CanvasGroupDefinition } from './ComponentCanvas';
import { CanvasRow, CanvasRows, CanvasSlot } from './canvasFrame';
import {
    ALERT_VARIANTS,
    SPLIT_FLAP_EASINGS,
    SPLIT_FLAP_SIZES,
    SPLIT_FLAP_SURFACES,
    SPLIT_FLAP_THEMES,
    TODAY_BADGE_SIZES,
} from './canvasCatalog';

const ALERT_TITLE = 'Trip saved';
const ALERT_TEXT = 'Your changes to Lisbon are in your library.';

// --- Alert -----------------------------------------------------------------

const AlertContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="variant" minSlotWidth={300}>
            {ALERT_VARIANTS.map((variant) => (
                <CanvasSlot key={variant} label={variant}>
                    <Alert variant={variant}>
                        <Info />
                        <AlertTitle>{ALERT_TITLE}</AlertTitle>
                        <AlertDescription>{ALERT_TEXT}</AlertDescription>
                    </Alert>
                </CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={300}>
            <CanvasSlot label="icon, title, description">
                <Alert><Info /><AlertTitle>{ALERT_TITLE}</AlertTitle><AlertDescription>{ALERT_TEXT}</AlertDescription></Alert>
            </CanvasSlot>
            <CanvasSlot label="no icon">
                <Alert><AlertTitle>{ALERT_TITLE}</AlertTitle><AlertDescription>{ALERT_TEXT}</AlertDescription></Alert>
            </CanvasSlot>
            <CanvasSlot label="title only">
                <Alert><Info /><AlertTitle>{ALERT_TITLE}</AlertTitle></Alert>
            </CanvasSlot>
            <CanvasSlot label="long title clamps to one line">
                <Alert><Warning /><AlertTitle>{`${ALERT_TITLE}, along with every stop, note and booking you added this week`}</AlertTitle><AlertDescription>{ALERT_TEXT}</AlertDescription></Alert>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Card ------------------------------------------------------------------

const CardContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="composition" minSlotWidth={300}>
            <CanvasSlot label="header + content">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Lisbon in spring</CardTitle>
                        <CardDescription>5 nights · 3 stops</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">Tram 28, Alfama and a day in Sintra.</CardContent>
                </Card>
            </CanvasSlot>
            <CanvasSlot label="with CardAction">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Lisbon in spring</CardTitle>
                        <CardDescription>5 nights · 3 stops</CardDescription>
                        <CardAction><Badge variant="success">Public</Badge></CardAction>
                    </CardHeader>
                    <CardContent className="text-sm">Tram 28, Alfama and a day in Sintra.</CardContent>
                </Card>
            </CanvasSlot>
            <CanvasSlot label="with footer, divided">
                <Card className="w-full">
                    <CardHeader className="border-b">
                        <CardTitle>Lisbon in spring</CardTitle>
                        <CardDescription>5 nights · 3 stops</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">Tram 28, Alfama and a day in Sintra.</CardContent>
                    <CardFooter className="justify-end gap-2 border-t">
                        <Button variant="ghost" size="sm">Share</Button>
                        <Button size="sm">Open trip</Button>
                    </CardFooter>
                </Card>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Table -----------------------------------------------------------------

const TABLE_ROWS = [
    { city: 'Lisbon', nights: 3, cost: '€420' },
    { city: 'Porto', nights: 2, cost: '€260' },
    { city: 'Faro', nights: 2, cost: '€240' },
];

const SampleTable: React.FC<{ caption?: boolean; footer?: boolean }> = ({ caption, footer }) => (
    <Table>
        {caption && <TableCaption>Stops on the Portugal trip</TableCaption>}
        <TableHeader>
            <TableRow><TableHead>City</TableHead><TableHead>Nights</TableHead><TableHead className="text-end">Cost</TableHead></TableRow>
        </TableHeader>
        <TableBody>
            {TABLE_ROWS.map((row) => (
                <TableRow key={row.city}><TableCell>{row.city}</TableCell><TableCell>{row.nights}</TableCell><TableCell className="text-end">{row.cost}</TableCell></TableRow>
            ))}
        </TableBody>
        {footer && (
            <TableFooter>
                <TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-end">€920</TableCell></TableRow>
            </TableFooter>
        )}
    </Table>
);

const TableContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="composition" minSlotWidth={300}>
            <CanvasSlot label="basic"><SampleTable /></CanvasSlot>
            <CanvasSlot label="caption"><SampleTable caption /></CanvasSlot>
            <CanvasSlot label="footer"><SampleTable footer /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- TodayBadge --------------------------------------------------------------

const TodayBadgeContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="size" minSlotWidth={150}>
            {TODAY_BADGE_SIZES.map((size) => (
                <CanvasSlot key={size} label={size}><TodayBadge size={size} /></CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={150}>
            <CanvasSlot label="default label"><TodayBadge /></CanvasSlot>
            <CanvasSlot label="label=&quot;Heute&quot;"><TodayBadge label="Heute" /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- AnimatedNumber ----------------------------------------------------------

const AnimatedNumberContent: React.FC = () => {
    const [value, setValue] = useState(1240);
    const formats: Array<{ label: string; format?: React.ComponentProps<typeof AnimatedNumber>['format']; prefix?: string; suffix?: string }> = [
        { label: 'plain' },
        { label: 'currency EUR', format: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 } },
        { label: 'compact', format: { notation: 'compact' } },
        { label: 'suffix', suffix: ' km' },
    ];
    return (
        <CanvasRows>
            <CanvasRow title="control" minSlotWidth={200}>
                <CanvasSlot label="changes every example below">
                    <Button variant="outline" onClick={() => setValue((current) => (current === 1240 ? 18_950 : 1240))}>Change value</Button>
                </CanvasSlot>
            </CanvasRow>
            <CanvasRow title="format" minSlotWidth={200}>
                {formats.map((entry) => (
                    <CanvasSlot key={entry.label} label={entry.label}>
                        <AnimatedNumber className="text-2xl font-semibold text-foreground" value={value} locales="en-US" format={entry.format} prefix={entry.prefix} suffix={entry.suffix} />
                    </CanvasSlot>
                ))}
            </CanvasRow>
            <CanvasRow title="value" minSlotWidth={200}>
                <CanvasSlot label="number"><AnimatedNumber className="text-2xl font-semibold text-foreground" value={value} locales="en-US" /></CanvasSlot>
                <CanvasSlot label="null with fallback"><AnimatedNumber className="text-2xl font-semibold text-foreground" value={null} fallback="—" /></CanvasSlot>
            </CanvasRow>
        </CanvasRows>
    );
};

// --- SplitFlap -------------------------------------------------------------

const SPLIT_FLAP_WORDS = ['LISBON', 'PORTO '];

const SplitFlapContent: React.FC = () => {
    const [index, setIndex] = useState(0);
    const word = SPLIT_FLAP_WORDS[index];
    return (
        <CanvasRows>
            <CanvasRow title="control" minSlotWidth={200}>
                <CanvasSlot label="flips every example below">
                    <Button variant="outline" onClick={() => setIndex((current) => (current + 1) % SPLIT_FLAP_WORDS.length)}>Next word</Button>
                </CanvasSlot>
            </CanvasRow>
            <CanvasRow title="size" minSlotWidth={320}>
                {SPLIT_FLAP_SIZES.map((size) => (
                    <CanvasSlot key={size} label={size}><SplitFlap value={word} size={size} /></CanvasSlot>
                ))}
            </CanvasRow>
            <CanvasRow title="theme" minSlotWidth={320}>
                {SPLIT_FLAP_THEMES.map((theme) => (
                    <CanvasSlot key={theme} label={theme}><SplitFlap value={word} theme={theme} /></CanvasSlot>
                ))}
            </CanvasRow>
            <CanvasRow title="surface" minSlotWidth={320}>
                {SPLIT_FLAP_SURFACES.map((surface) => (
                    <CanvasSlot key={surface} label={surface}><SplitFlap value={word} surface={surface} /></CanvasSlot>
                ))}
            </CanvasRow>
            <CanvasRow title="easing" minSlotWidth={320}>
                {SPLIT_FLAP_EASINGS.map((easing) => (
                    <CanvasSlot key={easing} label={easing}><SplitFlap value={word} easing={easing} /></CanvasSlot>
                ))}
            </CanvasRow>
        </CanvasRows>
    );
};

// --- Accordion -------------------------------------------------------------

const ACCORDION_ITEMS = [
    { value: 'pace', title: 'How is the pace chosen?', body: 'From the answers you give when you create the trip.' },
    { value: 'share', title: 'Who can see a shared trip?', body: 'Anyone with the link, until you turn sharing off.' },
    { value: 'offline', title: 'Does it work offline?', body: 'Trips you opened recently stay readable offline.' },
];

const AccordionExample: React.FC<{ type: 'single' | 'multiple'; collapsible?: boolean; disabledItem?: string }> = ({ type, collapsible, disabledItem }) => {
    const items = ACCORDION_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value} disabled={item.value === disabledItem}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>{item.body}</AccordionContent>
        </AccordionItem>
    ));
    return type === 'single'
        ? <Accordion type="single" collapsible={collapsible} defaultValue="pace">{items}</Accordion>
        : <Accordion type="multiple" defaultValue={['pace']}>{items}</Accordion>;
};

const AccordionContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="type" minSlotWidth={300}>
            <CanvasSlot label="single"><AccordionExample type="single" /></CanvasSlot>
            <CanvasSlot label="single · collapsible"><AccordionExample type="single" collapsible /></CanvasSlot>
            <CanvasSlot label="multiple"><AccordionExample type="multiple" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="state" minSlotWidth={300}>
            <CanvasSlot label="item disabled"><AccordionExample type="multiple" disabledItem="offline" /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Collapsible -------------------------------------------------------------

const CollapsibleExample: React.FC<{ defaultOpen?: boolean; disabled?: boolean }> = ({ defaultOpen, disabled }) => (
    <Collapsible defaultOpen={defaultOpen} disabled={disabled} className="flex w-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">3 hidden stops</span>
            <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Toggle hidden stops"><CaretUpDown /></Button>
            </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>Sintra</span><span>Cascais</span><span>Évora</span>
        </CollapsibleContent>
    </Collapsible>
);

const CollapsibleContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="state" minSlotWidth={260}>
            <CanvasSlot label="closed"><CollapsibleExample /></CanvasSlot>
            <CanvasSlot label="open"><CollapsibleExample defaultOpen /></CanvasSlot>
            <CanvasSlot label="disabled"><CollapsibleExample disabled /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Tabs --------------------------------------------------------------------

const TabsExample: React.FC<{ variant?: 'default' | 'line'; orientation?: 'horizontal' | 'vertical'; disabledTab?: boolean }> = ({ variant, orientation, disabledTab }) => (
    <Tabs defaultValue="plan" orientation={orientation}>
        <TabsList variant={variant}>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="notes" disabled={disabledTab}>Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="text-sm text-muted-foreground">Day by day.</TabsContent>
        <TabsContent value="map" className="text-sm text-muted-foreground">Every stop on one map.</TabsContent>
        <TabsContent value="notes" className="text-sm text-muted-foreground">Things to remember.</TabsContent>
    </Tabs>
);

const TabsContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="variant" minSlotWidth={300}>
            <CanvasSlot label="default"><TabsExample variant="default" /></CanvasSlot>
            <CanvasSlot label="line"><TabsExample variant="line" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="orientation" minSlotWidth={300}>
            <CanvasSlot label="horizontal"><TabsExample orientation="horizontal" /></CanvasSlot>
            <CanvasSlot label="vertical"><TabsExample orientation="vertical" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="state" minSlotWidth={300}>
            <CanvasSlot label="trigger disabled"><TabsExample disabledTab /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- ScrollArea --------------------------------------------------------------

const SCROLL_STOPS = ['Lisbon', 'Sintra', 'Cascais', 'Óbidos', 'Nazaré', 'Coimbra', 'Aveiro', 'Porto', 'Braga', 'Guimarães', 'Viana do Castelo', 'Peneda-Gerês'];

const ScrollAreaContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="orientation" minSlotWidth={300}>
            <CanvasSlot label="vertical">
                <ScrollArea className="h-48 w-full rounded-md border border-border">
                    <div className="flex flex-col p-3 text-sm text-foreground">
                        {SCROLL_STOPS.map((stop) => <span key={stop} className="border-b border-border py-2 last:border-b-0">{stop}</span>)}
                    </div>
                </ScrollArea>
            </CanvasSlot>
            <CanvasSlot label="horizontal">
                <ScrollArea className="w-full rounded-md border border-border">
                    <div className="flex w-max gap-2 p-3">
                        {SCROLL_STOPS.map((stop) => <Badge key={stop} variant="neutral">{stop}</Badge>)}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- SettingsPanel -----------------------------------------------------------

const SettingsContent: React.FC = () => {
    const [isPublic, setIsPublic] = useState(true);
    return (
        <CanvasRows>
            <CanvasRow title="SettingsRow layout" minSlotWidth={380}>
                {(['inline', 'stacked'] as const).map((layout) => (
                    <CanvasSlot key={layout} label={layout}>
                        <SettingsPanel className="w-full">
                            <SettingsGroup className="p-4">
                                <SettingsRow label="Public trip" description="Anyone with the link can view it." layout={layout}>
                                    <Switch aria-label="Public trip" checked={isPublic} onCheckedChange={setIsPublic} />
                                </SettingsRow>
                            </SettingsGroup>
                        </SettingsPanel>
                    </CanvasSlot>
                ))}
            </CanvasRow>
            <CanvasRow title="composition" minSlotWidth={380}>
                <CanvasSlot label="SettingsSection with icon, aside, note">
                    <SettingsSection
                        className="w-full"
                        title="Sharing"
                        description="Who can open this trip."
                        icon={<Gear />}
                        aside={<Badge variant="success">Live</Badge>}
                    >
                        <SettingsRow label="Public trip" description="Anyone with the link can view it." note={isPublic ? 'The link works now.' : 'The link is off.'}>
                            <Switch aria-label="Public trip" checked={isPublic} onCheckedChange={setIsPublic} />
                        </SettingsRow>
                    </SettingsSection>
                </CanvasSlot>
                <CanvasSlot label="SettingsCard">
                    <SettingsCard className="w-full" title="Sharing" description="Who can open this trip." icon={<MapPin />}>
                        <SettingsRow label="Public trip" description="Anyone with the link can view it.">
                            <Switch aria-label="Public trip" checked={isPublic} onCheckedChange={setIsPublic} />
                        </SettingsRow>
                    </SettingsCard>
                </CanvasSlot>
            </CanvasRow>
        </CanvasRows>
    );
};

export const DISPLAY_GROUPS: CanvasGroupDefinition[] = [
    { id: 'alert', title: 'Alert', render: () => <AlertContent /> },
    { id: 'card', title: 'Card', render: () => <CardContentGroup /> },
    { id: 'table', title: 'Table', render: () => <TableContent /> },
    { id: 'tabs', title: 'Tabs', render: () => <TabsContentGroup /> },
    { id: 'accordion', title: 'Accordion', render: () => <AccordionContentGroup /> },
    { id: 'collapsible', title: 'Collapsible', render: () => <CollapsibleContentGroup /> },
    { id: 'scroll-area', title: 'ScrollArea', render: () => <ScrollAreaContent /> },
    { id: 'settings-panel', title: 'SettingsPanel', render: () => <SettingsContent /> },
    { id: 'today-badge', title: 'TodayBadge', render: () => <TodayBadgeContent /> },
    { id: 'animated-number', title: 'AnimatedNumber', render: () => <AnimatedNumberContent /> },
    { id: 'split-flap', title: 'SplitFlap', render: () => <SplitFlapContent /> },
];
