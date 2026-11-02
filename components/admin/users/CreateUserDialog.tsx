import React, { useState } from 'react';
import { EnvelopeSimple, UserPlus } from '@phosphor-icons/react';
import { PLAN_ORDER } from '../../../config/planCatalog';
import type { PlanTierKey } from '../../../types';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AdminErrorAlert } from '../AdminErrorAlert';
import { getPlanName } from '../adminUsersModel';
import { INITIAL_CREATE_DRAFT, type CreateUserDraft, type CreateUserMode } from './useAdminUsersActions';

interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isSaving: boolean;
    /** Resolves to null on success (after `onCreated`) or to the error to show. */
    onCreate: (mode: CreateUserMode, draft: CreateUserDraft, onCreated: () => void) => Promise<string | null>;
}

/**
 * Invite (emails a set-password link) or direct creation (with an initial
 * password). The draft and mode survive closing, so a cancelled form reopens
 * as it was; the error does not.
 */
export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ open, onOpenChange, isSaving, onCreate }) => {
    const [mode, setMode] = useState<CreateUserMode>('invite');
    const [draft, setDraft] = useState<CreateUserDraft>(INITIAL_CREATE_DRAFT);
    const [error, setError] = useState<string | null>(null);

    const updateDraft = (patch: Partial<CreateUserDraft>) => setDraft((current) => ({ ...current, ...patch }));

    const close = () => {
        setError(null);
        onOpenChange(false);
    };

    const submit = async () => {
        setError(null);
        const nextError = await onCreate(mode, draft, () => {
            setDraft(INITIAL_CREATE_DRAFT);
            onOpenChange(false);
        });
        if (nextError) setError(nextError);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) onOpenChange(true);
                else close();
            }}
        >
            <DialogContent className="w-[min(96vw,560px)]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">Create user</DialogTitle>
                    <DialogDescription>
                        An invite emails a link to set a password. Direct creation makes the account now with a password you choose.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <div className="inline-flex w-fit gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="Creation mode">
                        <Button
                            type="button"
                            variant="toggle"
                            size="sm"
                            aria-pressed={mode === 'invite'}
                            onClick={() => setMode('invite')}
                            className="h-7"
                        >
                            <EnvelopeSimple />
                            Invite
                        </Button>
                        <Button
                            type="button"
                            variant="toggle"
                            size="sm"
                            aria-pressed={mode === 'direct'}
                            onClick={() => setMode('direct')}
                            className="h-7"
                        >
                            <UserPlus />
                            Direct
                        </Button>
                    </div>

                    {error && <AdminErrorAlert message={error} />}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="text-xs font-medium text-muted-foreground">Email</span>
                            <Input
                                aria-label="Email"
                                type="email"
                                value={draft.email}
                                onChange={(event) => updateDraft({ email: event.target.value })}
                                placeholder="name@example.com"
                                className="h-9"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">First name</span>
                            <Input
                                aria-label="First name"
                                value={draft.firstName}
                                onChange={(event) => updateDraft({ firstName: event.target.value })}
                                className="h-9"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Last name</span>
                            <Input
                                aria-label="Last name"
                                value={draft.lastName}
                                onChange={(event) => updateDraft({ lastName: event.target.value })}
                                className="h-9"
                            />
                        </label>
                        {mode === 'direct' && (
                            <label className="flex flex-col gap-1.5 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Initial password</span>
                                <Input
                                    aria-label="Initial password"
                                    value={draft.password}
                                    onChange={(event) => updateDraft({ password: event.target.value })}
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="At least 8 characters"
                                    className="h-9"
                                />
                            </label>
                        )}
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="text-xs font-medium text-muted-foreground">Starting plan</span>
                            <Select
                                value={draft.tierKey}
                                onValueChange={(value) => updateDraft({ tierKey: value as PlanTierKey })}
                            >
                                <SelectTrigger className="h-9" aria-label="Starting plan">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLAN_ORDER.map((tierKey) => (
                                        <SelectItem key={`create-tier-${tierKey}`} value={tierKey}>
                                            {getPlanName(tierKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={close}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || !draft.email.trim() || (mode === 'direct' && !draft.password.trim())}
                        >
                            {mode === 'invite' ? 'Send invite' : 'Create user'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
