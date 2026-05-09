// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLoginModal } from '../../hooks/useLoginModal';

describe('hooks/useLoginModal', () => {
    it('returns the provider fallback when used outside LoginModalProvider', () => {
        const { result } = renderHook(() => useLoginModal());

        expect(result.current.isLoginModalOpen).toBe(false);
        expect(result.current.openLoginModal).toEqual(expect.any(Function));
        expect(result.current.closeLoginModal).toEqual(expect.any(Function));
    });
});
