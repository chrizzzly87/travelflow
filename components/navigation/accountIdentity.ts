/**
 * How a signed-in account is named and abbreviated in menus: the public
 * account menu and the admin sidebar both use these, so a person reads the same
 * name and initials everywhere.
 */
type AccountProfileLike = { firstName?: string; lastName?: string; displayName?: string | null; username?: string | null } | null;

export const computeInitial = (
    profile: AccountProfileLike,
    email: string | null,
    userId?: string | null
): string => {
    const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';
    const lastName = typeof profile?.lastName === 'string' ? profile.lastName.trim() : '';
    if (firstName && lastName) {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) {
        return firstName.slice(0, 2).toUpperCase();
    }
    if (lastName) {
        return lastName.slice(0, 2).toUpperCase();
    }

    const displayName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
    if (displayName) {
        const words = displayName.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
            return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
        }
        return words[0].slice(0, 2).toUpperCase();
    }

    const username = typeof profile?.username === 'string' ? profile.username.trim().replace(/^@+/, '') : '';
    if (username) {
        return username.slice(0, 2).toUpperCase();
    }

    const normalized = (email || '').trim();
    if (normalized) {
        return normalized.charAt(0).toUpperCase();
    }

    const fallback = (userId || '').trim();
    if (fallback) return fallback.charAt(0).toUpperCase();
    return 'U';
};

export const buildAccountDisplayName = (
    profile: AccountProfileLike,
    email: string | null,
    userId?: string | null
): string => {
    const firstName = typeof profile?.firstName === 'string' ? profile.firstName.trim() : '';
    const lastName = typeof profile?.lastName === 'string' ? profile.lastName.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;

    const displayName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
    if (displayName) return displayName;

    const username = typeof profile?.username === 'string' ? profile.username.trim() : '';
    if (username) return username.startsWith('@') ? username : `@${username}`;

    const normalizedEmail = (email || '').trim();
    if (normalizedEmail) return normalizedEmail;

    const fallbackUserId = (userId || '').trim();
    if (fallbackUserId) return `User ${fallbackUserId.slice(0, 8)}`;
    return 'Signed-in account';
};

export const buildAccountTriggerName = (
    profile: AccountProfileLike,
    email: string | null,
    userId?: string | null
): string => {
    const username = typeof profile?.username === 'string' ? profile.username.trim() : '';
    if (username) return username.startsWith('@') ? username : `@${username}`;
    return buildAccountDisplayName(profile, email, userId);
};
