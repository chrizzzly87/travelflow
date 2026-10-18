import themeBoot from './document/theme-boot.js?raw';
import interactionBoot from './document/interaction-boot.js?raw';

// Only these pre-bundle operations require inline code. Fonts, route hints and
// loading UI are declared by native heads/components instead of mutating HTML.
export const bootScripts = [
    { id: 'theme', attributes: { 'data-tf-theme-boot': '' }, code: themeBoot },
    { id: 'interaction', attributes: { 'data-tf-hydration-bridge': '' }, code: interactionBoot },
];
