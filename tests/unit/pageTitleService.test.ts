import { describe, expect, it } from 'vitest';
import { resolvePageTitle, type PageTitleLabels } from '../../services/pageTitleService';

const APP_NAME = 'TravelFlow';

const LABELS: PageTitleLabels = {
  features: 'Features',
  inspirations: 'Inspirations',
  updates: 'News & Updates',
  blog: 'Blog',
  pricing: 'Pricing',
  faq: 'FAQ',
  contact: 'Contact',
  imprint: 'Imprint',
  privacy: 'Privacy',
  terms: 'Terms',
  cookies: 'Cookies',
  login: 'Login',
  resetPassword: 'Set a new password',
  shareUnavailable: 'This shared trip is no longer available',
  createTrip: 'Create Trip',
  createTripLab: 'Create Trip Labs',
  profile: 'Profile',
  profileSettings: 'Profile settings',
  profileOnboarding: 'Complete profile',
  admin: 'Admin',
  notFound: '404',
};

describe('services/pageTitleService', () => {
  it('resolves homepage and static marketing routes', () => {
    expect(resolvePageTitle({ pathname: '/', appName: APP_NAME, labels: LABELS })).toBe('TravelFlow');
    expect(resolvePageTitle({ pathname: '/features', appName: APP_NAME, labels: LABELS })).toBe('Features · TravelFlow');
    expect(resolvePageTitle({ pathname: '/de/pricing', appName: APP_NAME, labels: LABELS })).toBe('Pricing · TravelFlow');
    expect(resolvePageTitle({ pathname: '/de/blog/', appName: APP_NAME, labels: LABELS })).toBe('Blog · TravelFlow');
  });

  it('resolves dynamic inspirations and blog titles', () => {
    expect(resolvePageTitle({ pathname: '/inspirations/country/costa-rica', appName: APP_NAME, labels: LABELS })).toBe('Costa Rica · Inspirations · TravelFlow');
    expect(resolvePageTitle({ pathname: '/blog/spring-getaways', appName: APP_NAME, labels: LABELS, blogPostTitle: 'Spring Getaways' })).toBe('Spring Getaways · TravelFlow');
    expect(resolvePageTitle({ pathname: '/blog/spring-getaways', appName: APP_NAME, labels: LABELS })).toBe('Blog · TravelFlow');
  });

  it('resolves create-trip and trip routes', () => {
    expect(resolvePageTitle({ pathname: '/create-trip', appName: APP_NAME, labels: LABELS })).toBe('Create Trip · TravelFlow');
    expect(resolvePageTitle({ pathname: '/create-trip/labs/classic-card', appName: APP_NAME, labels: LABELS })).toBe('Create Trip Labs · TravelFlow');
    expect(resolvePageTitle({ pathname: '/trip/abc123', appName: APP_NAME, labels: LABELS, tripTitle: 'Japan Road Trip' })).toBe('Japan Road Trip · TravelFlow');
    expect(resolvePageTitle({ pathname: '/trip/abc123', appName: APP_NAME, labels: LABELS })).toBe('Create Trip · TravelFlow');
  });

  it('resolves profile and admin routes with section context', () => {
    expect(resolvePageTitle({ pathname: '/profile', appName: APP_NAME, labels: LABELS })).toBe('Profile · TravelFlow');
    expect(resolvePageTitle({ pathname: '/profile/settings', appName: APP_NAME, labels: LABELS })).toBe('Profile settings · TravelFlow');
    expect(resolvePageTitle({ pathname: '/admin/users', appName: APP_NAME, labels: LABELS })).toBe('Admin · Users · TravelFlow');
  });

  it('falls back to not-found title for unknown routes', () => {
    expect(resolvePageTitle({ pathname: '/something-unknown', appName: APP_NAME, labels: LABELS })).toBe('404 · TravelFlow');
  });
});
