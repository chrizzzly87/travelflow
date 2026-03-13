import { tripEvalTests } from './tripEvalScenarios.ts';

export default {
    description: 'TravelFlow classic AI trip creation regression checks',
    prompts: ['{{destinationPrompt}}'],
    providers: [
        {
            id: 'file://tripEvalProvider.ts',
            config: {
                targetId: 'openai:gpt-5.4',
            },
            label: 'openai:gpt-5.4',
        },
        {
            id: 'file://tripEvalProvider.ts',
            config: {
                targetId: 'gemini:gemini-3.1-pro-preview',
            },
            label: 'gemini:gemini-3.1-pro-preview',
        },
    ],
    tests: tripEvalTests,
};
