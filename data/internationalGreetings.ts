import {
  INTERNATIONAL_GREETINGS_CATALOG,
  pickRandomInternationalGreeting as pickRandomGreetingFromCatalog,
} from './internationalGreetingsCatalog';

export interface InternationalGreeting {
  greeting: string;
  language: string;
  context: string;
}

export const INTERNATIONAL_GREETINGS: InternationalGreeting[] = INTERNATIONAL_GREETINGS_CATALOG.map((entry) => ({
  greeting: entry.greeting,
  language: entry.language,
  context: entry.context,
}));

export const pickRandomInternationalGreeting = (): InternationalGreeting => {
  const entry = pickRandomGreetingFromCatalog();
  return {
    greeting: entry.greeting,
    language: entry.language,
    context: entry.context,
  };
};
