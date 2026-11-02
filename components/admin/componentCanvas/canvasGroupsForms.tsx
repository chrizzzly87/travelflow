import React, { useId, useState } from 'react';
import { At, Copy, Globe, MagnifyingGlass, PaperPlaneRight } from '@phosphor-icons/react';

import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
    InputGroupTextarea,
} from '../../ui/input-group';
import { Label } from '../../ui/label';
import { NumberInput } from '../../ui/number-input';
import {
    Questionnaire,
    QuestionnaireActions,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireChoices,
    QuestionnaireDescription,
    QuestionnaireItem,
    QuestionnaireTitle,
} from '../../ui/questionnaire';
import { SearchInput } from '../../ui/search-input';
import { SegmentedControl, type SegmentedOption } from '../../ui/segmented-control';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import type { CanvasGroupDefinition } from './ComponentCanvas';
import { CanvasRow, CanvasRows, CanvasSlot } from './canvasFrame';

const FIELD_SLOT = 260;
const SAMPLE_CITY = 'Lisbon';
const SAMPLE_NOTE = 'Pack light: the trams are narrow.';

// --- Input -----------------------------------------------------------------

const InputContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="empty">
                <Input aria-label="City" placeholder={SAMPLE_CITY} />
            </CanvasSlot>
            <CanvasSlot label="filled">
                <Input aria-label="City" defaultValue={SAMPLE_CITY} />
            </CanvasSlot>
            <CanvasSlot label="disabled">
                <Input aria-label="City" defaultValue={SAMPLE_CITY} disabled />
            </CanvasSlot>
            <CanvasSlot label="readOnly">
                <Input aria-label="City" defaultValue={SAMPLE_CITY} readOnly />
            </CanvasSlot>
            <CanvasSlot label="aria-invalid">
                <Input aria-label="City" defaultValue={SAMPLE_CITY} aria-invalid />
            </CanvasSlot>
        </CanvasRow>
        <CanvasRow title="type" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="text">
                <Input aria-label="City" type="text" defaultValue={SAMPLE_CITY} />
            </CanvasSlot>
            <CanvasSlot label="email">
                <Input aria-label="Email" type="email" placeholder="ana@example.com" />
            </CanvasSlot>
            <CanvasSlot label="password">
                <Input aria-label="Password" type="password" defaultValue="example" autoComplete="off" />
            </CanvasSlot>
            <CanvasSlot label="date">
                <Input aria-label="Date" type="date" defaultValue="2026-05-14" />
            </CanvasSlot>
            <CanvasSlot label="file">
                <Input aria-label="Attachment" type="file" />
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Textarea --------------------------------------------------------------

const TextareaContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="empty">
                <Textarea aria-label="Note" placeholder={SAMPLE_NOTE} />
            </CanvasSlot>
            <CanvasSlot label="filled">
                <Textarea aria-label="Note" defaultValue={SAMPLE_NOTE} />
            </CanvasSlot>
            <CanvasSlot label="disabled">
                <Textarea aria-label="Note" defaultValue={SAMPLE_NOTE} disabled />
            </CanvasSlot>
            <CanvasSlot label="aria-invalid">
                <Textarea aria-label="Note" defaultValue={SAMPLE_NOTE} aria-invalid />
            </CanvasSlot>
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="grows with content">
                <Textarea
                    aria-label="Note"
                    defaultValue={`${SAMPLE_NOTE}\nDay 2: Sintra.\nDay 3: Cascais.\nDay 4: back to the city.`}
                />
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Label -----------------------------------------------------------------

const LabelContent: React.FC = () => {
    const id = useId();
    return (
        <CanvasRows>
            <CanvasRow title="composition" minSlotWidth={FIELD_SLOT}>
                <CanvasSlot label="with input">
                    <div className="flex w-full flex-col gap-2">
                        <Label htmlFor={`${id}-city`}>City</Label>
                        <Input id={`${id}-city`} placeholder={SAMPLE_CITY} />
                    </div>
                </CanvasSlot>
                <CanvasSlot label="with checkbox">
                    <div className="flex items-center gap-2">
                        <Checkbox id={`${id}-check`} />
                        <Label htmlFor={`${id}-check`}>City</Label>
                    </div>
                </CanvasSlot>
                <CanvasSlot label="peer disabled">
                    <div className="flex items-center gap-2">
                        <Checkbox id={`${id}-check-disabled`} disabled />
                        <Label htmlFor={`${id}-check-disabled`}>City</Label>
                    </div>
                </CanvasSlot>
            </CanvasRow>
        </CanvasRows>
    );
};

// --- Checkbox --------------------------------------------------------------

const CheckboxContent: React.FC = () => {
    const id = useId();
    const states = [
        { label: 'unchecked', props: { defaultChecked: false } },
        { label: 'checked', props: { defaultChecked: true } },
        { label: 'indeterminate', props: { defaultChecked: 'indeterminate' as const } },
        { label: 'disabled', props: { disabled: true } },
        { label: 'disabled · checked', props: { disabled: true, defaultChecked: true } },
    ];
    return (
        <CanvasRows>
            <CanvasRow title="state" minSlotWidth={170}>
                {states.map((state, index) => (
                    <CanvasSlot key={state.label} label={state.label}>
                        <div className="flex items-center gap-2">
                            <Checkbox id={`${id}-${index}`} {...state.props} />
                            <Label htmlFor={`${id}-${index}`}>Breakfast</Label>
                        </div>
                    </CanvasSlot>
                ))}
            </CanvasRow>
        </CanvasRows>
    );
};

// --- Switch ----------------------------------------------------------------

const SwitchContent: React.FC = () => {
    const states = [
        { label: 'off', props: { defaultChecked: false } },
        { label: 'on', props: { defaultChecked: true } },
        { label: 'disabled · off', props: { disabled: true } },
        { label: 'disabled · on', props: { disabled: true, defaultChecked: true } },
    ];
    return (
        <CanvasRows>
            <CanvasRow title="state" minSlotWidth={170}>
                {states.map((state) => (
                    <CanvasSlot key={state.label} label={state.label}>
                        <Switch aria-label="Public trip" {...state.props} />
                    </CanvasSlot>
                ))}
            </CanvasRow>
        </CanvasRows>
    );
};

// --- Slider ----------------------------------------------------------------

const SliderContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="thumbs and state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="single">
                <Slider aria-label="Budget" defaultValue={[40]} />
            </CanvasSlot>
            <CanvasSlot label="range">
                <Slider aria-label="Budget" defaultValue={[25, 70]} />
            </CanvasSlot>
            <CanvasSlot label="step=10">
                <Slider aria-label="Budget" defaultValue={[40]} step={10} />
            </CanvasSlot>
            <CanvasSlot label="disabled">
                <Slider aria-label="Budget" defaultValue={[40]} disabled />
            </CanvasSlot>
        </CanvasRow>
        <CanvasRow title="orientation" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="horizontal">
                <Slider aria-label="Budget" defaultValue={[40]} orientation="horizontal" />
            </CanvasSlot>
            <CanvasSlot label="vertical">
                <div className="h-44">
                    <Slider aria-label="Budget" defaultValue={[40]} orientation="vertical" />
                </div>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- SegmentedControl ------------------------------------------------------

type DateMode = 'exact' | 'flexible';
const DATE_MODE_OPTIONS: Array<SegmentedOption<DateMode>> = [
    { value: 'exact', label: 'Exact dates' },
    { value: 'flexible', label: 'Flexible window' },
];

const SegmentedExample: React.FC<{
    size?: 'sm' | 'md';
    disabled?: boolean;
    options?: Array<SegmentedOption<DateMode>>;
}> = ({ size, disabled, options = DATE_MODE_OPTIONS }) => {
    const name = useId();
    const [value, setValue] = useState<DateMode>('exact');
    return (
        <SegmentedControl<DateMode>
            name={name}
            label="Date mode"
            value={value}
            options={options}
            onChange={setValue}
            size={size}
            disabled={disabled}
        />
    );
};

const SegmentedContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="size" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="sm"><SegmentedExample size="sm" /></CanvasSlot>
            <CanvasSlot label="md"><SegmentedExample size="md" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="enabled"><SegmentedExample /></CanvasSlot>
            <CanvasSlot label="disabled"><SegmentedExample disabled /></CanvasSlot>
            <CanvasSlot label="option disabled">
                <SegmentedExample options={[DATE_MODE_OPTIONS[0], { ...DATE_MODE_OPTIONS[1], disabled: true }]} />
            </CanvasSlot>
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="srLabel (icon options)">
                <SegmentedExample
                    options={[
                        { value: 'exact', label: <At className="size-4" />, srLabel: 'Exact dates' },
                        { value: 'flexible', label: <Globe className="size-4" />, srLabel: 'Flexible window' },
                    ]}
                />
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Select ----------------------------------------------------------------

const CITY_OPTIONS = ['Lisbon', 'Porto', 'Coimbra', 'Faro'];

const SelectExample: React.FC<{
    placeholder?: boolean;
    disabled?: boolean;
    indicatorPosition?: 'left' | 'right';
    grouped?: boolean;
    longValue?: boolean;
}> = ({ placeholder, disabled, indicatorPosition, grouped, longValue }) => (
    <Select defaultValue={placeholder ? undefined : longValue ? 'long' : 'Lisbon'} disabled={disabled}>
        <SelectTrigger aria-label="City" className="w-full">
            <SelectValue placeholder="Choose a city" />
        </SelectTrigger>
        <SelectContent>
            {grouped ? (
                <>
                    <SelectGroup>
                        <SelectLabel>Portugal</SelectLabel>
                        <SelectItem value="Lisbon" indicatorPosition={indicatorPosition}>Lisbon</SelectItem>
                        <SelectItem value="Porto" indicatorPosition={indicatorPosition}>Porto</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                        <SelectLabel>Spain</SelectLabel>
                        <SelectItem value="Seville" indicatorPosition={indicatorPosition}>Seville</SelectItem>
                        <SelectItem value="Bilbao" indicatorPosition={indicatorPosition} disabled>Bilbao</SelectItem>
                    </SelectGroup>
                </>
            ) : (
                <>
                    {CITY_OPTIONS.map((city) => (
                        <SelectItem key={city} value={city} indicatorPosition={indicatorPosition}>{city}</SelectItem>
                    ))}
                    {longValue && (
                        <SelectItem value="long" indicatorPosition={indicatorPosition}>
                            Lisbon, Sintra and the Cascais coastline
                        </SelectItem>
                    )}
                </>
            )}
        </SelectContent>
    </Select>
);

const SelectContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="placeholder"><SelectExample placeholder /></CanvasSlot>
            <CanvasSlot label="selected"><SelectExample /></CanvasSlot>
            <CanvasSlot label="disabled"><SelectExample disabled /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="indicatorPosition" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="left"><SelectExample indicatorPosition="left" /></CanvasSlot>
            <CanvasSlot label="right"><SelectExample indicatorPosition="right" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="content" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="groups, separator, disabled item"><SelectExample grouped /></CanvasSlot>
            <CanvasSlot label="long value truncates">
                <div className="w-44"><SelectExample longValue /></div>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- NumberInput -----------------------------------------------------------

const NumberExample: React.FC<{
    steppers?: boolean;
    animated?: boolean;
    disabled?: boolean;
    prefix?: string;
    suffix?: string;
}> = (props) => {
    const [value, setValue] = useState<number | string>(4);
    return (
        <NumberInput
            aria-label="Nights"
            value={value}
            min={1}
            max={30}
            onChange={(event) => setValue(event.target.value)}
            {...props}
        />
    );
};

const NumberInputContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="feature" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="default"><NumberExample /></CanvasSlot>
            <CanvasSlot label="steppers"><NumberExample steppers /></CanvasSlot>
            <CanvasSlot label="animated=false"><NumberExample animated={false} /></CanvasSlot>
            <CanvasSlot label="suffix"><NumberExample suffix=" nights" /></CanvasSlot>
            <CanvasSlot label="prefix"><NumberExample prefix="× " /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="enabled"><NumberExample steppers /></CanvasSlot>
            <CanvasSlot label="disabled"><NumberExample steppers disabled /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- SearchInput -----------------------------------------------------------

const SearchExample: React.FC<{ initial?: string; clearable?: boolean; disabled?: boolean }> = ({ initial = '', clearable = true, disabled }) => {
    const [value, setValue] = useState(initial);
    return (
        <SearchInput
            aria-label="Search destinations"
            placeholder="Search destinations"
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onClear={clearable ? () => setValue('') : undefined}
        />
    );
};

const SearchInputContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="empty"><SearchExample /></CanvasSlot>
            <CanvasSlot label="with value (clear button)"><SearchExample initial={SAMPLE_CITY} /></CanvasSlot>
            <CanvasSlot label="no onClear"><SearchExample initial={SAMPLE_CITY} clearable={false} /></CanvasSlot>
            <CanvasSlot label="disabled"><SearchExample initial={SAMPLE_CITY} disabled /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- InputGroup ------------------------------------------------------------

const InputGroupContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="addon align" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="inline-start">
                <InputGroup>
                    <InputGroupAddon align="inline-start"><MagnifyingGlass /></InputGroupAddon>
                    <InputGroupInput aria-label="City" placeholder={SAMPLE_CITY} />
                </InputGroup>
            </CanvasSlot>
            <CanvasSlot label="inline-end">
                <InputGroup>
                    <InputGroupInput aria-label="City" placeholder={SAMPLE_CITY} />
                    <InputGroupAddon align="inline-end"><MagnifyingGlass /></InputGroupAddon>
                </InputGroup>
            </CanvasSlot>
            <CanvasSlot label="block-start">
                <InputGroup>
                    <InputGroupAddon align="block-start"><InputGroupText><MagnifyingGlass /> City</InputGroupText></InputGroupAddon>
                    <InputGroupInput aria-label="City" placeholder={SAMPLE_CITY} />
                </InputGroup>
            </CanvasSlot>
            <CanvasSlot label="block-end">
                <InputGroup>
                    <InputGroupInput aria-label="City" placeholder={SAMPLE_CITY} />
                    <InputGroupAddon align="block-end"><InputGroupText><MagnifyingGlass /> City</InputGroupText></InputGroupAddon>
                </InputGroup>
            </CanvasSlot>
        </CanvasRow>
        <CanvasRow title="button size" minSlotWidth={FIELD_SLOT}>
            {(['xs', 'sm'] as const).map((size) => (
                <CanvasSlot key={size} label={size}>
                    <InputGroup>
                        <InputGroupInput aria-label="Share link" defaultValue="travelflow.app/s/lisbon" readOnly />
                        <InputGroupAddon align="inline-end"><InputGroupButton size={size}>Copy</InputGroupButton></InputGroupAddon>
                    </InputGroup>
                </CanvasSlot>
            ))}
            {(['icon-xs', 'icon-sm'] as const).map((size) => (
                <CanvasSlot key={size} label={size}>
                    <InputGroup>
                        <InputGroupInput aria-label="Share link" defaultValue="travelflow.app/s/lisbon" readOnly />
                        <InputGroupAddon align="inline-end"><InputGroupButton size={size} aria-label="Copy"><Copy /></InputGroupButton></InputGroupAddon>
                    </InputGroup>
                </CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="content and state" minSlotWidth={FIELD_SLOT}>
            <CanvasSlot label="text addon">
                <InputGroup>
                    <InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>
                    <InputGroupInput aria-label="Website" placeholder="example.com" />
                </InputGroup>
            </CanvasSlot>
            <CanvasSlot label="textarea">
                <InputGroup>
                    <InputGroupTextarea aria-label="Message" placeholder={SAMPLE_NOTE} />
                    <InputGroupAddon align="block-end">
                        <InputGroupButton size="icon-xs" variant="default" aria-label="Send" className="ms-auto"><PaperPlaneRight /></InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
            </CanvasSlot>
            <CanvasSlot label="aria-invalid">
                <InputGroup>
                    <InputGroupAddon><MagnifyingGlass /></InputGroupAddon>
                    <InputGroupInput aria-label="City" defaultValue={SAMPLE_CITY} aria-invalid />
                </InputGroup>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Questionnaire ---------------------------------------------------------

const PACE_CHOICES = [
    { value: 'slow', label: 'Slow', description: 'One base, day trips out' },
    { value: 'balanced', label: 'Balanced', description: 'A new city every few days' },
    { value: 'fast', label: 'Fast', description: 'See as much as possible' },
];

const QuestionnaireExample: React.FC<{ type: 'single' | 'multiple'; disabled?: boolean; disabledChoice?: string }> = ({ type, disabled, disabledChoice }) => {
    const [value, setValue] = useState<string[]>(['balanced']);
    return (
        <Questionnaire className="w-full">
            <QuestionnaireItem>
                <QuestionnaireTitle>Travel pace</QuestionnaireTitle>
                <QuestionnaireDescription>Shapes how many stops the plan gets.</QuestionnaireDescription>
                <QuestionnaireChoices type={type} value={value} onValueChange={setValue} disabled={disabled}>
                    {PACE_CHOICES.map((choice) => (
                        <QuestionnaireChoice key={choice.value} value={choice.value} disabled={choice.value === disabledChoice}>
                            {choice.label}
                            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
                        </QuestionnaireChoice>
                    ))}
                </QuestionnaireChoices>
            </QuestionnaireItem>
            <QuestionnaireActions>
                <Button variant="ghost" size="sm" onClick={() => setValue([])}>Clear</Button>
            </QuestionnaireActions>
        </Questionnaire>
    );
};

const QuestionnaireContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="type" minSlotWidth={300}>
            <CanvasSlot label="single"><QuestionnaireExample type="single" /></CanvasSlot>
            <CanvasSlot label="multiple"><QuestionnaireExample type="multiple" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="state" minSlotWidth={300}>
            <CanvasSlot label="choice disabled"><QuestionnaireExample type="multiple" disabledChoice="fast" /></CanvasSlot>
            <CanvasSlot label="all disabled"><QuestionnaireExample type="multiple" disabled /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

export const FORM_GROUPS: CanvasGroupDefinition[] = [
    { id: 'input', title: 'Input', render: () => <InputContent /> },
    { id: 'textarea', title: 'Textarea', render: () => <TextareaContent /> },
    { id: 'label', title: 'Label', render: () => <LabelContent /> },
    { id: 'input-group', title: 'InputGroup', render: () => <InputGroupContent /> },
    { id: 'search-input', title: 'SearchInput', render: () => <SearchInputContent /> },
    { id: 'number-input', title: 'NumberInput', render: () => <NumberInputContent /> },
    { id: 'select', title: 'Select', render: () => <SelectContentGroup /> },
    { id: 'checkbox', title: 'Checkbox', render: () => <CheckboxContent /> },
    { id: 'switch', title: 'Switch', render: () => <SwitchContent /> },
    { id: 'slider', title: 'Slider', render: () => <SliderContent /> },
    { id: 'segmented-control', title: 'SegmentedControl', render: () => <SegmentedContent /> },
    { id: 'questionnaire', title: 'Questionnaire', render: () => <QuestionnaireContent /> },
];
