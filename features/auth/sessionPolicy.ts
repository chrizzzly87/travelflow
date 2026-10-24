import type { Session } from '@supabase/supabase-js';
import type { UserAccessContext } from '../../types';

/** isAuthenticated already excludes disabled accounts, so it cannot gate their eviction. */
export function shouldRevokeInactiveAccount(input: { isLoading: boolean; session: Session | null; access: UserAccessContext | null }): boolean {
    return !input.isLoading && Boolean(input.access?.userId)
        && input.access?.userId === input.session?.user.id
        && !input.access?.isAnonymous && input.access?.accountStatus !== 'active';
}
