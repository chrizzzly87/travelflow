import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-cleans when a global `afterEach` is injected by a
// test framework it recognises; under this Vitest setup it never was, so every
// render in a file stayed mounted until the worker exited.
//
// That is what makes PR Quality fail for no visible reason: a React tree left
// mounted can still hold scheduled concurrent work, and when the worker's jsdom
// is torn down first, React's `flushWork` runs against a missing `window`.
// Vitest reports it as an unhandled error and exits 1 with every test passing —
// e.g. run 35091017552, "388 passed / 2136 passed", `ReferenceError: window is
// not defined` from `getActiveElementDeep`, originating in SplitFlap.test.tsx.
//
// The default environment here is `node`, and files opt into jsdom with a
// docblock, so only unmount when there is a document to unmount from.
afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
