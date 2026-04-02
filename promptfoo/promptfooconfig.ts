import { tripEvalTests } from './tripEvalScenarios.ts';
import { tripEvalProviders } from './tripEvalProviders.ts';

export default {
    description: 'TravelFlow classic AI trip creation regression checks',
    prompts: ['{{destinationPrompt}}'],
    providers: tripEvalProviders,
    tests: tripEvalTests,
};
