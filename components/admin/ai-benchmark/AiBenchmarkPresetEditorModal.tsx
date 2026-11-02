import React from 'react';
import type { BenchmarkMaskScenario } from '../../../services/aiBenchmarkPreferencesService';
import { AppModal } from '../../ui/app-modal';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import type { BenchmarkDefaultDates, PresetEditorDraft } from './aiBenchmarkModel';

const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

const PresetEditorFields: React.FC<{
    editor: PresetEditorDraft;
    defaultDates: BenchmarkDefaultDates;
    onEdit: (patch: Partial<Pick<PresetEditorDraft, 'name' | 'description'>>) => void;
    onEditScenario: <K extends keyof BenchmarkMaskScenario>(key: K, value: BenchmarkMaskScenario[K]) => void;
}> = ({ editor, defaultDates, onEdit, onEditScenario }) => (
    <div className="grid grid-cols-1 gap-3">
        <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Name</span>
            <Input
                aria-label="Name"
                value={editor.name}
                onChange={(event) => onEdit({ name: event.target.value })}
            />
        </label>

        <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Description</span>
            <Input
                aria-label="Description"
                value={editor.description}
                onChange={(event) => onEdit({ description: event.target.value })}
            />
        </label>

        <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Destinations</span>
            <Input
                aria-label="Destinations"
                value={editor.scenario.destinations}
                onChange={(event) => onEditScenario('destinations', event.target.value)}
            />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Date mode</span>
                <Select
                    value={editor.scenario.dateInputMode}
                    onValueChange={(value) => onEditScenario('dateInputMode', value as BenchmarkMaskScenario['dateInputMode'])}
                >
                    <SelectTrigger aria-label="Date mode">
                        <SelectValue placeholder="Date mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="exact">Exact dates</SelectItem>
                        <SelectItem value="flex">Flexible window</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {editor.scenario.dateInputMode === 'flex' ? (
                <label className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>Flex weeks</span>
                    <Input
                        type="number"
                        aria-label="Flex weeks"
                        min={1}
                        max={12}
                        value={editor.scenario.flexWeeks}
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            const normalized = Number.isFinite(next) ? Math.min(12, Math.max(1, Math.round(next))) : 1;
                            onEditScenario('flexWeeks', normalized);
                        }}
                    />
                </label>
            ) : (
                <label className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>Start date</span>
                    <Input
                        type="date"
                        aria-label="Start date"
                        value={editor.scenario.startDate || defaultDates.startDate}
                        onChange={(event) => onEditScenario('startDate', event.target.value)}
                    />
                </label>
            )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {editor.scenario.dateInputMode === 'exact' ? (
                <label className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>End date</span>
                    <Input
                        type="date"
                        aria-label="End date"
                        value={editor.scenario.endDate || defaultDates.endDate}
                        onChange={(event) => onEditScenario('endDate', event.target.value)}
                    />
                </label>
            ) : (
                <div className="flex flex-col gap-1.5">
                    <span className={FIELD_LABEL_CLASS}>Flex window</span>
                    <Select
                        value={editor.scenario.flexWindow}
                        onValueChange={(value) => onEditScenario('flexWindow', value as BenchmarkMaskScenario['flexWindow'])}
                    >
                        <SelectTrigger aria-label="Flex window">
                            <SelectValue placeholder="Preferred time range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="spring">Spring</SelectItem>
                            <SelectItem value="summer">Summer</SelectItem>
                            <SelectItem value="autumn">Autumn</SelectItem>
                            <SelectItem value="winter">Winter</SelectItem>
                            <SelectItem value="shoulder">Shoulder</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Round trip</span>
                <Select
                    value={editor.scenario.roundTrip ? 'yes' : 'no'}
                    onValueChange={(value) => onEditScenario('roundTrip', value === 'yes')}
                >
                    <SelectTrigger aria-label="Round trip">
                        <SelectValue placeholder="Round trip" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Budget</span>
                <Select value={editor.scenario.budget} onValueChange={(value) => onEditScenario('budget', value)}>
                    <SelectTrigger aria-label="Budget">
                        <SelectValue placeholder="Budget" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Luxury">Luxury</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Pace</span>
                <Select value={editor.scenario.pace} onValueChange={(value) => onEditScenario('pace', value)}>
                    <SelectTrigger aria-label="Pace">
                        <SelectValue placeholder="Pace" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Relaxed">Relaxed</SelectItem>
                        <SelectItem value="Balanced">Balanced</SelectItem>
                        <SelectItem value="Fast">Fast</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Specific cities</span>
                <Input
                    aria-label="Specific cities"
                    value={editor.scenario.specificCities}
                    onChange={(event) => onEditScenario('specificCities', event.target.value)}
                />
            </label>
            <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Stops</span>
                <Input
                    type="number"
                    aria-label="Stops"
                    min={1}
                    max={20}
                    value={editor.scenario.numCities ?? ''}
                    onChange={(event) => {
                        const next = event.target.value ? Number(event.target.value) : null;
                        onEditScenario('numCities', Number.isFinite(next as number) ? (next as number) : null);
                    }}
                />
            </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Traveler setup</span>
                <Select
                    value={editor.scenario.travelerSetup}
                    onValueChange={(value) => onEditScenario('travelerSetup', value as BenchmarkMaskScenario['travelerSetup'])}
                >
                    <SelectTrigger aria-label="Traveler setup">
                        <SelectValue placeholder="Traveler setup" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="couple">Couple</SelectItem>
                        <SelectItem value="friends">Friends</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Trip style</span>
                <Select
                    value={editor.scenario.tripStyleMask}
                    onValueChange={(value) => onEditScenario('tripStyleMask', value as BenchmarkMaskScenario['tripStyleMask'])}
                >
                    <SelectTrigger aria-label="Trip style">
                        <SelectValue placeholder="Trip style" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="everything_except_remote_work">Everything except remote work</SelectItem>
                        <SelectItem value="culture_focused">Culture focused</SelectItem>
                        <SelectItem value="food_focused">Food focused</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Transport</span>
                <Select
                    value={editor.scenario.transportMask}
                    onValueChange={(value) => onEditScenario('transportMask', value as BenchmarkMaskScenario['transportMask'])}
                >
                    <SelectTrigger aria-label="Transport">
                        <SelectValue placeholder="Transport" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="plane">Plane</SelectItem>
                        <SelectItem value="train">Train</SelectItem>
                        <SelectItem value="camper">Camper</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Notes/interests</span>
            <Textarea
                aria-label="Notes/interests"
                rows={3}
                value={editor.scenario.notes}
                onChange={(event) => onEditScenario('notes', event.target.value)}
                className="resize-y"
            />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <Checkbox
                aria-label="Route lock"
                checked={editor.scenario.routeLock}
                onCheckedChange={(checked) => onEditScenario('routeLock', checked === true)}
            />
            Route lock (metadata only)
        </label>
    </div>
);

/** Create or edit a saved trip template. */
export const AiBenchmarkPresetEditorModal: React.FC<{
    editor: PresetEditorDraft | null;
    defaultDates: BenchmarkDefaultDates;
    onEdit: (patch: Partial<Pick<PresetEditorDraft, 'name' | 'description'>>) => void;
    onEditScenario: <K extends keyof BenchmarkMaskScenario>(key: K, value: BenchmarkMaskScenario[K]) => void;
    onClose: () => void;
    onSave: () => void;
}> = ({ editor, defaultDates, onEdit, onEditScenario, onClose, onSave }) => (
    <AppModal
        isOpen={Boolean(editor)}
        onClose={onClose}
        title={editor?.mode === 'create' ? 'New trip template' : 'Edit trip template'}
        description="Templates are saved to your admin account and reused for every run."
        size="lg"
        mobileSheet={false}
        footer={(
            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="button" size="sm" onClick={onSave}>
                    Save template
                </Button>
            </div>
        )}
    >
        {editor && (
            <PresetEditorFields editor={editor} defaultDates={defaultDates} onEdit={onEdit} onEditScenario={onEditScenario} />
        )}
    </AppModal>
);
