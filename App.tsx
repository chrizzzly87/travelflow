/** Native Start application shell. Domain runtimes are loaded by their route groups. */
export { default } from './app/shell/ApplicationShell';
export { resolveTermsNoticeState, shouldRedirectToTermsAcceptance } from './features/auth/termsPolicy';
