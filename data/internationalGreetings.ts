export interface InternationalGreeting {
  greeting: string;
  language: string;
  context: string;
}

export const INTERNATIONAL_GREETINGS: InternationalGreeting[] = [
  {
    greeting: 'Aloha',
    language: 'Hawaiian',
    context: 'Big adventures start with warm welcomes.',
  },
  {
    greeting: 'Namaste',
    language: 'Hindi',
    context: 'Map your next route with intention and curiosity.',
  },
  {
    greeting: 'Selamat Pagi',
    language: 'Indonesian',
    context: 'New day, new route ideas, same travel momentum.',
  },
  {
    greeting: 'Guten Morgen',
    language: 'German',
    context: 'Your profile is ready with the trips that matter most.',
  },
  {
    greeting: 'Buenos dias',
    language: 'Spanish',
    context: 'Jump into your newest plans in one tap.',
  },
  {
    greeting: 'Bonjour',
    language: 'French',
    context: 'Pin your highlights and keep planning at a glance.',
  },
  {
    greeting: 'Konnichiwa',
    language: 'Japanese',
    context: 'Favorites, recent plans, and highlights are all in one place.',
  },
  {
    greeting: 'Buongiorno',
    language: 'Italian',
    context: 'Keep your best itineraries front and center.',
  },
  {
    greeting: 'Merhaba',
    language: 'Turkish',
    context: 'Find your next trip in seconds and keep moving.',
  },
  {
    greeting: 'Hej',
    language: 'Swedish',
    context: 'A clean trip overview makes planning feel effortless.',
  },
];

export const pickRandomInternationalGreeting = (): InternationalGreeting => {
  if (INTERNATIONAL_GREETINGS.length === 0) {
    return {
      greeting: 'Hello',
      language: 'English',
      context: 'Your trips are ready when you are.',
    };
  }

  const index = Math.floor(Math.random() * INTERNATIONAL_GREETINGS.length);
  return INTERNATIONAL_GREETINGS[index];
};
