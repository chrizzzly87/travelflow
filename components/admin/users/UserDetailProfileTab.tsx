import React from 'react';
import { PLAN_ORDER } from '../../../config/planCatalog';
import { PROFILE_ACCOUNT_STATUS_OPTIONS, PROFILE_GENDER_OPTIONS } from '../../../config/profileFields';
import type { PlanTierKey } from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { ProfileCountryRegionSelect } from '../../profile/ProfileCountryRegionSelect';
import { AdminSectionHeader } from '../AdminSectionHeader';
import {
    USERNAME_CHANGE_COOLDOWN_DAYS,
    formatAbsoluteTimestamp,
    getPlanName,
    getUsernameCooldownMeta,
    type ProfileGenderDraft,
    type UserAccountStatus,
    type UserRole,
} from '../adminUsersModel';
import type { AdminUserDetailApi } from './useAdminUserDetail';

const GENDER_UNSET_VALUE = '__gender_unset__';

/** The editable profile, plan, role, account status and entitlement overrides. Saved from the sheet footer. */
export const UserDetailProfileTab: React.FC<{
    detail: AdminUserDetailApi;
    usernameChangedAt: string | null | undefined;
    isSaving: boolean;
    onRevokeCooldown: () => void;
}> = ({ detail, usernameChangedAt, isSaving, onRevokeCooldown }) => {
    const { draft, updateProfileDraft } = detail;
    const profile = draft.profile;
    const cooldown = getUsernameCooldownMeta(usernameChangedAt);

    return (
        <>
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Profile" />
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">First name</span>
                        <Input
                            aria-label="First name"
                            value={profile.firstName}
                            onChange={(event) => updateProfileDraft({ firstName: event.target.value })}
                            className="h-9"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Last name</span>
                        <Input
                            aria-label="Last name"
                            value={profile.lastName}
                            onChange={(event) => updateProfileDraft({ lastName: event.target.value })}
                            className="h-9"
                        />
                    </label>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Username</span>
                            <Input
                                aria-label="Username"
                                value={profile.username}
                                onChange={(event) => updateProfileDraft({ username: event.target.value })}
                                className="h-9"
                            />
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                                Users can change their username once every {USERNAME_CHANGE_COOLDOWN_DAYS} days.{' '}
                                {cooldown.isActive
                                    ? `Cooldown ends ${formatAbsoluteTimestamp(cooldown.endsAt)}.`
                                    : 'No cooldown is active.'}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={onRevokeCooldown}
                                disabled={isSaving || !cooldown.isActive}
                            >
                                Revoke cooldown
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Gender</span>
                        <Select
                            value={profile.gender || GENDER_UNSET_VALUE}
                            onValueChange={(value) => {
                                updateProfileDraft({ gender: value === GENDER_UNSET_VALUE ? '' : value as ProfileGenderDraft });
                            }}
                        >
                            <SelectTrigger className="h-9" aria-label="Gender">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PROFILE_GENDER_OPTIONS.map((option) => (
                                    <SelectItem
                                        key={`profile-gender-${option.value || 'empty'}`}
                                        value={option.value || GENDER_UNSET_VALUE}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Preferred language</span>
                        <Input
                            aria-label="Preferred language"
                            value={profile.preferredLanguage}
                            onChange={(event) => updateProfileDraft({ preferredLanguage: event.target.value })}
                            className="h-9"
                        />
                    </label>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Country/Region</span>
                        <ProfileCountryRegionSelect
                            value={profile.country}
                            placeholder="Search country or region"
                            emptyLabel="No countries found"
                            toggleLabel="Toggle country/region options"
                            onValueChange={(nextCode) => updateProfileDraft({ country: nextCode })}
                        />
                    </div>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">City</span>
                        <Input
                            aria-label="City"
                            value={profile.city}
                            onChange={(event) => updateProfileDraft({ city: event.target.value })}
                            className="h-9"
                        />
                    </label>
                </div>
            </section>

            <section className="flex flex-col gap-3">
                <AdminSectionHeader
                    as="h3"
                    title="Access"
                    description="Plan, role and account state. Saved with the profile."
                />
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Plan</span>
                        <Select
                            value={draft.tier}
                            onValueChange={(value) => detail.setTierDraft(value as PlanTierKey)}
                        >
                            <SelectTrigger className="h-9" aria-label="Plan">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PLAN_ORDER.map((tierKey) => (
                                    <SelectItem key={`profile-tier-${tierKey}`} value={tierKey}>
                                        {getPlanName(tierKey)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Role</span>
                        <Select
                            value={profile.role}
                            onValueChange={(value) => updateProfileDraft({ role: value as UserRole })}
                        >
                            <SelectTrigger className="h-9" aria-label="Role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Account status</span>
                        <Select
                            value={profile.accountStatus}
                            onValueChange={(value) => updateProfileDraft({ accountStatus: value as UserAccountStatus })}
                        >
                            <SelectTrigger className="h-9" aria-label="Account status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PROFILE_ACCOUNT_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={`profile-status-${option.value}`} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <AdminSectionHeader
                    as="h3"
                    title="Entitlement overrides"
                    description="Optional JSON object that replaces individual plan limits for this user. Leave empty to use the plan's limits."
                />
                <Textarea
                    aria-label="Entitlement overrides"
                    value={draft.overrides}
                    onChange={(event) => detail.setOverrideDraft(event.target.value)}
                    placeholder={`{\n  "maxActiveTrips": 15\n}`}
                    className="min-h-[120px] font-mono text-xs"
                />
            </section>
        </>
    );
};
