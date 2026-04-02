import { tripEvalProviders } from './tripEvalProviders.ts';
import { tripSecurityEvalTests } from './tripSecurityEvalScenarios.ts';

export default {
    description: 'TravelFlow classic AI trip creation adversarial security checks',
    prompts: ['{{destinationPrompt}}'],
    providers: tripEvalProviders,
    tests: tripSecurityEvalTests,
};
