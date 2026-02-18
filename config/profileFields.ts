export type ProfileGenderOption = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';

export const PROFILE_GENDER_OPTIONS: Array<{ value: ProfileGenderOption; label: string }> = [
    { value: '', label: 'Not specified' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'non-binary', label: 'Non-binary' },
    { value: 'prefer-not', label: 'Prefer not to say' },
];

export const PROFILE_ACCOUNT_STATUS_OPTIONS: Array<{ value: 'active' | 'disabled' | 'deleted'; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'deleted', label: 'Deleted' },
];
