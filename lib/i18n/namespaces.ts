// Namespaces the app shell (App.tsx AppContent + navigation chrome) needs on
// every route. Loaded server-side in the root layout and injected before the
// first client render, so nothing suspends on i18n.
export const APP_SHELL_NAMESPACES = ['common', 'pages', 'auth', 'wip', 'legal', 'profile'];
