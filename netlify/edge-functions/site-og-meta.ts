import { escapeHtml } from "../edge-lib/trip-og-data.ts";
import { BLOG_OG_IMAGE_REVISION, getBlogImageMedia } from "../../data/blogImageMedia.ts";
import { APP_DEFAULT_DESCRIPTION, APP_NAME, applyAppNameTemplate } from "../../config/appGlobals.ts";

const SITE_NAME = APP_NAME;
const DEFAULT_DESCRIPTION = APP_DEFAULT_DESCRIPTION;
const SITE_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";
const DEFAULT_BLOG_OG_TINT = "#6366f1";
const SUPPORTED_LOCALES = ["en", "es", "de", "fr", "pt", "ru", "it", "pl"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: SupportedLocale = "en";

interface AlternateLink {
  hreflang: string;
  href: string;
}

interface Metadata {
  pageTitle: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  ogLogoUrl: string;
  robots: string;
  alternateLinks: AlternateLink[];
  htmlLang: string;
  htmlDir: "ltr" | "rtl";
}

interface PageDefinition {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  robots?: string;
  pill?: string;
  blogOgImagePath?: string;
  blogAccentTint?: string;
  blogTintIntensity?: number;
}

type LocalizedPageDefinition = Partial<
  Pick<PageDefinition, "title" | "description" | "ogTitle" | "ogDescription" | "pill">
>;

const MARKETING_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/features$/,
  /^\/inspirations$/,
  /^\/inspirations\/themes$/,
  /^\/inspirations\/best-time-to-travel$/,
  /^\/inspirations\/countries$/,
  /^\/inspirations\/events-and-festivals$/,
  /^\/inspirations\/weekend-getaways$/,
  /^\/inspirations\/country\/[^/]+$/,
  /^\/updates$/,
  /^\/blog$/,
  /^\/blog\/[^/]+$/,
  /^\/pricing$/,
  /^\/faq$/,
  /^\/share-unavailable$/,
  /^\/login$/,
  /^\/contact$/,
  /^\/imprint$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/cookies$/,
];

const TOOL_PATH_PREFIXES = ["/create-trip", "/trip", "/s", "/example", "/admin", "/api"];

const PAGE_META: Record<string, PageDefinition> = {
  "/": {
    title: "{{appName}}",
    description: "Plan smarter trips with timeline + map routing and share them beautifully.",
    pill: "{{appName}}",
  },
  "/create-trip": {
    title: "Create Trip",
    description: "Build your itinerary with flexible stops, routes, and timeline planning.",
    pill: "TRIP PLANNER",
  },
  "/features": {
    title: "Features",
    description: "See everything {{appName}} offers for planning and sharing better adventures.",
    pill: "FEATURES",
  },
  "/updates": {
    title: "Product Updates",
    description: "Catch the latest {{appName}} improvements and recently shipped features.",
    pill: "PRODUCT UPDATES",
  },
  "/blog": {
    title: "{{appName}} Blog",
    description: "Guides, trip-planning ideas, and practical workflow tips from the {{appName}} team.",
    pill: "BLOG",
  },
  "/login": {
    title: "Login",
    description: "Sign in and continue planning your next trip in {{appName}}.",
  },
  "/contact": {
    title: "Contact",
    description: "Reach out to report translation issues or localization feedback for {{appName}}.",
  },
  "/imprint": {
    title: "Imprint",
    description: "Legal and company information for {{appName}}.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "Learn how {{appName}} handles personal data and privacy protection.",
  },
  "/terms": {
    title: "Terms of Service",
    description: "Read the terms that govern the use of {{appName}}.",
  },
  "/cookies": {
    title: "Cookie Policy",
    description: "Understand how {{appName}} uses cookies and similar technologies.",
  },
  "/inspirations": {
    title: "Where Will You Go Next?",
    description: "Browse curated trip ideas by theme, month, country, or upcoming festivals.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/themes": {
    title: "Travel by Theme",
    description: "Find curated trip ideas that match your travel style — adventure, food, photography, and more.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/best-time-to-travel": {
    title: "When to Go Where",
    description: "Month-by-month guide to the best time to visit destinations around the world.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/countries": {
    title: "Explore by Country",
    description: "Country-specific travel guides with best-month picks, top cities, and local tips.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/events-and-festivals": {
    title: "Plan Around a Festival",
    description: "Discover upcoming festivals and build your itinerary around the event.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/weekend-getaways": {
    title: "Quick Escapes for Busy Travelers",
    description: "2–3 day getaway ideas for spontaneous adventurers — pack light and make the most of a long weekend.",
    pill: "TRIP INSPIRATIONS",
  },
  "/pricing": {
    title: "Simple, Transparent Pricing",
    description: "Start for free and upgrade when you need more. No hidden fees, cancel anytime.",
    pill: "PRICING",
  },
  "/faq": {
    title: "Frequently Asked Questions",
    description: "Answers to common questions about {{appName}}, pricing, and trip sharing.",
    pill: "FAQ",
  },
  "/share-unavailable": {
    title: "Shared Trip Unavailable",
    description: "The shared trip link is unavailable or expired.",
  },
};

const LOCALIZED_PAGE_META: Record<string, Partial<Record<SupportedLocale, LocalizedPageDefinition>>> = {
  "/": {
    es: {
      description: "Planifica viajes de forma más inteligente con línea de tiempo y mapa, y compártelos fácilmente.",
    },
    de: {
      description: "Plane smartere Reisen mit Timeline und Karte und teile sie einfach.",
    },
    fr: {
      description: "Planifiez des voyages plus malins avec timeline et carte, puis partagez-les facilement.",
    },
    it: {
      description: "Pianifica viaggi migliori con timeline e mappa e condividili facilmente.",
    },
    ru: {
      description: "Планируйте поездки умнее с таймлайном и картой и делитесь ими без лишних шагов.",
    },
    pt: {
      description: "Plane viagens de forma mais inteligente com linha do tempo e mapa, e partilhe tudo com facilidade.",
    },
    pl: {
      description: "Planuj podróże sprytniej dzięki osi czasu i mapie, a potem łatwo je udostępniaj.",
    },
  },
  "/features": {
    es: { title: "Funciones", description: "Descubre todo lo que {{appName}} ofrece para planificar y compartir mejores viajes." },
    de: { title: "Funktionen", description: "Entdecke alle Funktionen von {{appName}} für bessere Reiseplanung." },
    fr: { title: "Fonctionnalités", description: "Découvrez toutes les fonctionnalités de {{appName}} pour mieux planifier vos voyages." },
    it: { title: "Funzionalità", description: "Scopri tutte le funzionalità di {{appName}} per pianificare viaggi migliori." },
    ru: { title: "Возможности", description: "Узнайте, как {{appName}} помогает планировать поездки удобнее и быстрее." },
    pt: { title: "Funcionalidades", description: "Descubra tudo o que o {{appName}} oferece para planear e partilhar melhores viagens." },
    pl: { title: "Funkcje", description: "Sprawdź wszystko, co {{appName}} oferuje do lepszego planowania i udostępniania podróży." },
  },
  "/updates": {
    es: { title: "Novedades del producto", description: "Sigue las últimas mejoras y funcionalidades lanzadas en {{appName}}." },
    de: { title: "Neuigkeiten", description: "Alle neuen Verbesserungen und veröffentlichten Funktionen in {{appName}}." },
    fr: { title: "Nouveautés", description: "Les dernières améliorations et fonctionnalités publiées dans {{appName}}." },
    it: { title: "Novità", description: "Tutti gli ultimi miglioramenti e le funzionalità rilasciate in {{appName}}." },
    ru: { title: "Новости и обновления", description: "Последние улучшения и новые функции {{appName}}." },
    pt: { title: "Novidades do produto", description: "Acompanhe as melhorias mais recentes e as funcionalidades lançadas no {{appName}}." },
    pl: { title: "Nowości produktu", description: "Sprawdź najnowsze usprawnienia i funkcje wdrożone w {{appName}}." },
  },
  "/blog": {
    es: { title: "Blog", description: "Guías y consejos prácticos para planificar mejores viajes con {{appName}}." },
    de: { title: "Blog", description: "Guides und Tipps für smartere Reiseplanung mit {{appName}}." },
    fr: { title: "Blog", description: "Guides et conseils pratiques pour mieux planifier vos voyages avec {{appName}}." },
    it: { title: "Blog", description: "Guide e consigli pratici per pianificare meglio i viaggi con {{appName}}." },
    ru: { title: "Блог", description: "Гайды и советы по планированию поездок с {{appName}}." },
    pt: { title: "Blog", description: "Guias e dicas práticas para planear viagens melhores com o {{appName}}." },
    pl: { title: "Blog", description: "Poradniki i praktyczne wskazówki, które pomagają lepiej planować podróże z {{appName}}." },
  },
  "/pricing": {
    es: { title: "Precios", description: "Empieza gratis y mejora cuando lo necesites. Transparente y sin costes ocultos." },
    de: { title: "Preise", description: "Starte kostenlos und upgrade bei Bedarf. Transparent und ohne versteckte Kosten." },
    fr: { title: "Tarifs", description: "Commencez gratuitement et passez a une offre superieure si besoin. Sans frais caches." },
    it: { title: "Prezzi", description: "Inizia gratis e passa a un piano superiore quando serve. Nessun costo nascosto." },
    ru: { title: "Тарифы", description: "Начните бесплатно и переходите на расширенный план при необходимости. Без скрытых платежей." },
    pt: { title: "Preços", description: "Comece grátis e faça upgrade quando precisar. Transparente e sem custos escondidos." },
    pl: { title: "Cennik", description: "Zacznij za darmo i przejdź na wyższy plan, gdy będzie potrzeba. Bez ukrytych opłat." },
  },
  "/faq": {
    es: { title: "Preguntas frecuentes", description: "Respuestas a preguntas comunes sobre {{appName}}, precios y viajes compartidos." },
    de: { title: "FAQ", description: "Antworten auf häufige Fragen zu {{appName}}, Preisen und Teilen von Reisen." },
    fr: { title: "FAQ", description: "Réponses aux questions fréquentes sur {{appName}}, les tarifs et le partage de voyages." },
    it: { title: "FAQ", description: "Risposte alle domande frequenti su {{appName}}, prezzi e condivisione dei viaggi." },
    ru: { title: "FAQ", description: "Ответы на частые вопросы о {{appName}}, тарифах и совместном доступе к поездкам." },
    pt: { title: "Perguntas frequentes", description: "Respostas às perguntas mais comuns sobre {{appName}}, preços e partilha de viagens." },
    pl: { title: "Najczęściej zadawane pytania", description: "Odpowiedzi na najczęstsze pytania o {{appName}}, cennik i udostępnianie podróży." },
  },
  "/share-unavailable": {
    es: { title: "Viaje compartido no disponible", description: "Este enlace de viaje compartido ya no está disponible o ha caducado." },
    de: { title: "Geteilte Reise nicht verfügbar", description: "Dieser geteilte Reiselink ist nicht mehr verfügbar oder abgelaufen." },
    fr: { title: "Voyage partagé indisponible", description: "Ce lien de voyage partagé n'est plus disponible ou a expiré." },
    it: { title: "Viaggio condiviso non disponibile", description: "Questo link condiviso non è più disponibile o è scaduto." },
    ru: { title: "Общий маршрут недоступен", description: "Ссылка на общий маршрут недоступна или истекла." },
    pt: { title: "Viagem partilhada indisponível", description: "Este link de viagem partilhada não está disponível ou expirou." },
    pl: { title: "Udostępniona podróż jest niedostępna", description: "Ten link do udostępnionej podróży jest niedostępny lub wygasł." },
  },
  "/login": {
    es: { title: "Iniciar sesión", description: "Inicia sesión y sigue planificando tu próximo viaje en {{appName}}." },
    de: { title: "Anmelden", description: "Melde dich an und plane deine nächste Reise in {{appName}} weiter." },
    fr: { title: "Connexion", description: "Connectez-vous pour reprendre la planification de votre prochain voyage dans {{appName}}." },
    it: { title: "Accedi", description: "Accedi e continua a pianificare il tuo prossimo viaggio in {{appName}}." },
    ru: { title: "Вход", description: "Войдите, чтобы продолжить планирование следующей поездки в {{appName}}." },
    pt: { title: "Iniciar sessão", description: "Inicie sessão e continue a planear a sua próxima viagem no {{appName}}." },
    pl: { title: "Logowanie", description: "Zaloguj się i kontynuuj planowanie kolejnej podróży w {{appName}}." },
  },
  "/contact": {
    es: { title: "Contacto", description: "Reporta errores de traducción o comparte feedback de localización sobre {{appName}}." },
    de: { title: "Kontakt", description: "Melde Übersetzungsfehler oder Lokalisierungsfeedback zu {{appName}}." },
    fr: { title: "Contact", description: "Signalez des erreurs de traduction ou vos retours de localisation pour {{appName}}." },
    it: { title: "Contatti", description: "Segnala errori di traduzione o feedback sulla localizzazione di {{appName}}." },
    ru: { title: "Контакты", description: "Сообщите об ошибках перевода или оставьте отзыв о локализации {{appName}}." },
    pt: { title: "Contacto", description: "Reporte erros de tradução ou partilhe feedback de localização sobre o {{appName}}." },
    pl: { title: "Kontakt", description: "Zgłoś błędy tłumaczenia lub prześlij opinię o lokalizacji {{appName}}." },
  },
  "/imprint": {
    es: { title: "Aviso legal", description: "Información legal y corporativa sobre {{appName}}." },
    de: { title: "Impressum", description: "Rechtliche Informationen und Unternehmensangaben zu {{appName}}." },
    fr: { title: "Mentions légales", description: "Informations légales et sociétaires concernant {{appName}}." },
    it: { title: "Note legali", description: "Informazioni legali e societarie su {{appName}}." },
    ru: { title: "Реквизиты", description: "Юридическая и корпоративная информация о {{appName}}." },
    pt: { title: "Aviso legal", description: "Informações legais e empresariais sobre o {{appName}}." },
    pl: { title: "Informacje prawne", description: "Informacje prawne i firmowe dotyczące {{appName}}." },
  },
  "/privacy": {
    es: { title: "Política de privacidad", description: "Descubre cómo {{appName}} trata los datos personales y protege la privacidad." },
    de: { title: "Datenschutzerklärung", description: "Erfahre, wie {{appName}} personenbezogene Daten und Privatsphäre schützt." },
    fr: { title: "Politique de confidentialité", description: "Découvrez comment {{appName}} traite les données personnelles et protège la vie privée." },
    it: { title: "Informativa sulla privacy", description: "Scopri come {{appName}} gestisce i dati personali e protegge la privacy." },
    ru: { title: "Политика конфиденциальности", description: "Узнайте, как {{appName}} обрабатывает персональные данные и защищает конфиденциальность." },
    pt: { title: "Política de privacidade", description: "Saiba como o {{appName}} trata dados pessoais e protege a privacidade." },
    pl: { title: "Polityka prywatności", description: "Sprawdź, jak {{appName}} przetwarza dane osobowe i chroni prywatność." },
  },
  "/terms": {
    es: { title: "Términos del servicio", description: "Consulta los términos que regulan el uso de {{appName}}." },
    de: { title: "Nutzungsbedingungen", description: "Lies die Bedingungen für die Nutzung von {{appName}}." },
    fr: { title: "Conditions d'utilisation", description: "Consultez les conditions qui régissent l'utilisation de {{appName}}." },
    it: { title: "Termini di servizio", description: "Leggi i termini che regolano l'uso di {{appName}}." },
    ru: { title: "Условия использования", description: "Ознакомьтесь с условиями использования {{appName}}." },
    pt: { title: "Termos de serviço", description: "Leia os termos que regem a utilização do {{appName}}." },
    pl: { title: "Warunki korzystania z usługi", description: "Przeczytaj zasady korzystania z {{appName}}." },
  },
  "/cookies": {
    es: { title: "Política de cookies", description: "Descubre cómo {{appName}} usa cookies y tecnologías similares." },
    de: { title: "Cookie-Richtlinie", description: "Erfahre, wie {{appName}} Cookies und ähnliche Technologien verwendet." },
    fr: { title: "Politique de cookies", description: "Comprenez comment {{appName}} utilise les cookies et technologies similaires." },
    it: { title: "Informativa cookie", description: "Scopri come {{appName}} utilizza cookie e tecnologie simili." },
    ru: { title: "Политика cookie", description: "Узнайте, как {{appName}} использует cookie и похожие технологии." },
    pt: { title: "Política de cookies", description: "Saiba como o {{appName}} usa cookies e tecnologias semelhantes." },
    pl: { title: "Polityka cookies", description: "Dowiedz się, jak {{appName}} używa plików cookie i podobnych technologii." },
  },
  "/inspirations": {
    es: {
      title: "¿A dónde viajarás después?",
      description: "Explora ideas de viaje por temática, mes, país o festivales próximos.",
      pill: "INSPIRACIÓN DE VIAJES",
    },
    de: {
      title: "Wohin geht es als Nächstes?",
      description: "Entdecke kuratierte Reiseideen nach Thema, Monat, Land oder kommenden Festivals.",
      pill: "REISEINSPIRATIONEN",
    },
    fr: {
      title: "Où partirez-vous ensuite ?",
      description: "Explorez des idées de voyages par thème, mois, pays ou festivals à venir.",
      pill: "INSPIRATIONS",
    },
    it: {
      title: "Dove andrai la prossima volta?",
      description: "Esplora idee di viaggio per tema, mese, paese o festival in arrivo.",
      pill: "ISPIRAZIONI",
    },
    ru: {
      title: "Куда поедете в следующий раз?",
      description: "Смотрите идеи маршрутов по темам, месяцам, странам и ближайшим фестивалям.",
      pill: "ИДЕИ ПУТЕШЕСТВИЙ",
    },
    pt: {
      title: "Para onde vai a seguir?",
      description: "Explore ideias de viagem por tema, mês, país ou festivais que estão a chegar.",
      pill: "INSPIRAÇÃO DE VIAGENS",
    },
    pl: {
      title: "Dokąd wybierzesz się następnym razem?",
      description: "Przeglądaj pomysły na podróże według motywu, miesiąca, kraju lub nadchodzących festiwali.",
      pill: "INSPIRACJE PODRÓŻNICZE",
    },
  },
  "/inspirations/themes": {
    es: { title: "Viajar por temática" },
    de: { title: "Nach Reisethema planen" },
    fr: { title: "Voyager par thème" },
    it: { title: "Viaggia per tema" },
    ru: { title: "Путешествия по темам" },
    pt: { title: "Viajar por tema" },
    pl: { title: "Podróże według motywu" },
  },
  "/inspirations/best-time-to-travel": {
    es: { title: "Cuándo ir y a dónde" },
    de: { title: "Wann du wohin reisen solltest" },
    fr: { title: "Quand partir et où" },
    it: { title: "Quando andare e dove" },
    ru: { title: "Когда и куда ехать" },
    pt: { title: "Quando ir e para onde" },
    pl: { title: "Kiedy i dokąd jechać" },
  },
  "/inspirations/countries": {
    es: { title: "Explorar destinos por país" },
    de: { title: "Reiseziele nach Ländern entdecken" },
    fr: { title: "Explorer les destinations par pays" },
    it: { title: "Esplora destinazioni per paese" },
    ru: { title: "Направления по странам" },
    pt: { title: "Explorar destinos por país" },
    pl: { title: "Odkrywaj kierunki według kraju" },
  },
  "/inspirations/events-and-festivals": {
    es: { title: "Planear alrededor de un festival" },
    de: { title: "Reise rund um Festivals planen" },
    fr: { title: "Planifier autour d'un festival" },
    it: { title: "Pianifica intorno a un festival" },
    ru: { title: "Планируйте поездку вокруг фестиваля" },
    pt: { title: "Planear à volta de um festival" },
    pl: { title: "Zaplanuj podróż wokół festiwalu" },
  },
  "/inspirations/weekend-getaways": {
    es: { title: "Escapadas rápidas para agendas ocupadas" },
    de: { title: "Kurze Auszeiten für Vielbeschaftigte" },
    fr: { title: "Escapades rapides pour voyageurs occupes" },
    it: { title: "Fughe rapide per chi ha poco tempo" },
    ru: { title: "Быстрые поездки для занятых" },
    pt: { title: "Escapadinhas rápidas para quem tem pouco tempo" },
    pl: { title: "Szybkie wypady dla zapracowanych" },
  },
};

interface BlogMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
}

const BLOG_META: Record<string, BlogMeta> = {
  "best-time-visit-japan": {
    title: "The Best Time to Visit Japan — A Month-by-Month Guide",
    description: "Japan transforms with every season. From cherry blossoms to powder snow, here's when to go.",
    ogTitle: "Best Time to Visit Japan — Month by Month",
    ogDescription: "Sakura, festivals, autumn foliage, and powder snow — find your perfect month to visit Japan.",
  },
  "budget-travel-europe": {
    title: "Budget Travel Hacks for Europe",
    description: "Smart timing, local habits, and a few practical tricks can cut your Europe costs in half.",
    ogDescription: "Spend less, see more. Practical tips on timing, transport, and staying smart across Europe.",
  },
  "festival-travel-guide": {
    title: "How to Plan a Trip Around a Festival",
    description: "Festival-centered trips are some of the most memorable journeys. Here's how to plan one.",
    ogDescription: "Build your next trip around a great event — from choosing the festival to planning the days around it.",
  },
  "how-to-plan-multi-city-trip": {
    title: "How to Plan the Perfect Multi-City Trip",
    description: "Practical advice on route planning, timing, and logistics for multi-destination travel.",
    ogDescription: "Plan a smooth multi-stop itinerary with smart routing, realistic timing, and less stress.",
  },
  "weekend-getaway-tips": {
    title: "Weekend Getaway Planning: From Idea to Boarding Pass",
    description: "How to squeeze the most out of a 2–3 day trip without the stress.",
    ogTitle: "Weekend Getaway Planning Made Simple",
    ogDescription: "Make every hour count on a 2–3 day escape. Quick to plan, easy to enjoy.",
  },
};

const BLOG_LOCALES_BY_SLUG: Record<string, SupportedLocale[]> = {
  "best-time-visit-japan": ["en"],
  "budget-travel-europe": ["en"],
  "festival-travel-guide": ["en"],
  "how-to-plan-multi-city-trip": ["en"],
  "weekend-getaway-tips": ["en"],
};

const isSupportedLocale = (value?: string | null): value is SupportedLocale => {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
};

const normalizePath = (pathname: string): string => {
  const raw = pathname || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
};

const matchesPrefix = (pathname: string, prefix: string): boolean => {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const isToolBasePath = (pathname: string): boolean => {
  return TOOL_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
};

const isLocalizedMarketingBasePath = (pathname: string): boolean => {
  if (isToolBasePath(pathname)) return false;
  return MARKETING_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
};

const buildLocalizedPath = (basePath: string, locale: SupportedLocale): string => {
  if (locale === DEFAULT_LOCALE) return basePath;
  if (basePath === "/") return `/${locale}`;
  return `/${locale}${basePath}`;
};

const pathToTitle = (pathname: string): string => {
  if (pathname === "/") return SITE_NAME;
  const leaf = pathname.split("/").filter(Boolean).slice(-1)[0] || "Page";
  const words = leaf
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return words.length > 0 ? words.join(" ") : "Page";
};

const finalizePageDefinition = (page: PageDefinition): PageDefinition => ({
  ...page,
  title: applyAppNameTemplate(page.title),
  description: applyAppNameTemplate(page.description),
  ogTitle: page.ogTitle ? applyAppNameTemplate(page.ogTitle) : undefined,
  ogDescription: page.ogDescription ? applyAppNameTemplate(page.ogDescription) : undefined,
  pill: page.pill ? applyAppNameTemplate(page.pill) : undefined,
});

const withLocaleOverrides = (
  basePath: string,
  locale: SupportedLocale,
  page: PageDefinition,
): PageDefinition => {
  const localized = LOCALIZED_PAGE_META[basePath]?.[locale];
  if (!localized) return finalizePageDefinition(page);
  return finalizePageDefinition({
    ...page,
    ...localized,
  });
};

const getCountryRouteMeta = (country: string, locale: SupportedLocale): PageDefinition => {
  switch (locale) {
    case "es":
      return finalizePageDefinition({
        title: `Viajar a ${country}`,
        description: `Todo lo que necesitas para planificar tu viaje a ${country}: mejores meses, itinerarios populares y consejos útiles.`,
        pill: "INSPIRACIÓN DE VIAJES",
      });
    case "de":
      return finalizePageDefinition({
        title: `Reise nach ${country}`,
        description: `Plane deine Reise nach ${country} - beste Reisezeit, beliebte Routen und praktische Tipps.`,
        pill: "REISEINSPIRATIONEN",
      });
    case "fr":
      return finalizePageDefinition({
        title: `Voyager en ${country}`,
        description: `Tout pour planifier votre voyage en ${country} : meilleures periodes, itinéraires populaires et conseils utiles.`,
        pill: "INSPIRATIONS",
      });
    case "it":
      return finalizePageDefinition({
        title: `Viaggia in ${country}`,
        description: `Tutto ciò che serve per pianificare un viaggio in ${country}: periodi migliori, itinerari popolari e consigli utili.`,
        pill: "ISPIRAZIONI",
      });
    case "ru":
      return finalizePageDefinition({
        title: `Путешествие в ${country}`,
        description: `Все для планирования поездки в ${country}: лучшие месяцы, популярные маршруты и полезные советы.`,
        pill: "ИДЕИ ПУТЕШЕСТВИЙ",
      });
    case "pt":
      return finalizePageDefinition({
        title: `Viajar para ${country}`,
        description: `Tudo o que precisa para planear a sua viagem a ${country}: melhores meses, roteiros populares e dicas úteis.`,
        pill: "INSPIRAÇÃO DE VIAGENS",
      });
    case "pl":
      return finalizePageDefinition({
        title: `Podróż do ${country}`,
        description: `Wszystko, czego potrzebujesz, aby zaplanować podróż do ${country}: najlepsze miesiące, popularne trasy i praktyczne wskazówki.`,
        pill: "INSPIRACJE PODRÓŻNICZE",
      });
    default:
      return finalizePageDefinition({
        title: `Travel to ${country}`,
        description: `Plan your trip to ${country} - best months, itineraries, and tips.`,
        pill: "TRIP INSPIRATIONS",
      });
  }
};

const getPageDefinition = (basePath: string, locale: SupportedLocale): PageDefinition => {
  if (PAGE_META[basePath]) return withLocaleOverrides(basePath, locale, PAGE_META[basePath]);

  if (basePath.startsWith("/admin")) {
    return finalizePageDefinition({
      title: "Admin Dashboard",
      description: "Internal {{appName}} admin workspace.",
      robots: "noindex,nofollow,max-image-preview:large",
    });
  }

  const blogMatch = basePath.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const slug = decodeURIComponent(blogMatch[1]);
    const blog = BLOG_META[slug];
    const media = getBlogImageMedia(slug, blog ? blog.title : pathToTitle(basePath));
    return finalizePageDefinition({
      title: blog ? blog.title : pathToTitle(basePath),
      description: blog ? blog.description : "Read this article on the {{appName}} blog.",
      ogTitle: blog?.ogTitle,
      ogDescription: blog?.ogDescription,
      pill: "BLOG",
      blogOgImagePath: media.ogVertical.source,
      blogAccentTint: DEFAULT_BLOG_OG_TINT,
      blogTintIntensity: 60,
    });
  }

  const countryMatch = basePath.match(/^\/inspirations\/country\/([^/]+)$/);
  if (countryMatch) {
    const country = decodeURIComponent(countryMatch[1])
      .split(/[-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return getCountryRouteMeta(country, locale);
  }

  if (basePath.startsWith("/inspirations")) {
    return finalizePageDefinition({
      title: pathToTitle(basePath),
      description: "Explore curated trip ideas and travel inspiration on {{appName}}.",
      pill: "TRIP INSPIRATIONS",
    });
  }

  return finalizePageDefinition({
    title: pathToTitle(basePath),
    description: DEFAULT_DESCRIPTION,
  });
};

const stripSeoTags = (html: string): string => {
  const patterns = [
    /<title>[\s\S]*?<\/title>/gi,
    /<meta[^>]+name=["']description["'][^>]*>/gi,
    /<meta[^>]+name=["']robots["'][^>]*>/gi,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<meta[^>]+http-equiv=["']content-language["'][^>]*>/gi,
    /<link[^>]+rel=["']canonical["'][^>]*>/gi,
    /<link[^>]+rel=["']alternate["'][^>]+hreflang=["'][^"']+["'][^>]*>/gi,
  ];
  return patterns.reduce((acc, regex) => acc.replace(regex, ""), html);
};

const setHtmlLangAttributes = (html: string, lang: string, dir: "ltr" | "rtl"): string => {
  const safeLang = escapeHtml(lang);
  const safeDir = escapeHtml(dir);

  return html.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    let nextAttrs = attrs;

    if (/\slang\s*=\s*["'][^"']*["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/(\slang\s*=\s*["'])[^"']*(["'])/i, `$1${safeLang}$2`);
    } else {
      nextAttrs += ` lang="${safeLang}"`;
    }

    if (/\sdir\s*=\s*["'][^"']*["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/(\sdir\s*=\s*["'])[^"']*(["'])/i, `$1${safeDir}$2`);
    } else {
      nextAttrs += ` dir="${safeDir}"`;
    }

    return `<html${nextAttrs}>`;
  });
};

const buildMetaTags = (meta: Metadata): string => {
  const title = escapeHtml(meta.pageTitle);
  const description = escapeHtml(meta.description);
  const ogTitle = escapeHtml(meta.ogTitle);
  const ogDescription = escapeHtml(meta.ogDescription);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);
  const ogImageUrl = escapeHtml(meta.ogImageUrl);
  const ogLogoUrl = escapeHtml(meta.ogLogoUrl);
  const robots = escapeHtml(meta.robots);
  const contentLanguage = escapeHtml(meta.htmlLang);

  const alternateTags = meta.alternateLinks.map((link) => {
    const hreflang = escapeHtml(link.hreflang);
    const href = escapeHtml(link.href);
    return `<link rel="alternate" hreflang="${hreflang}" href="${href}" />`;
  });

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    ...alternateTags,
    `<meta http-equiv="content-language" content="${contentLanguage}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${ogTitle}" />`,
    `<meta property="og:description" content="${ogDescription}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${ogTitle}" />`,
    `<meta property="og:logo" content="${ogLogoUrl}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${ogTitle}" />`,
    `<meta name="twitter:description" content="${ogDescription}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
  ].join("\n");
};

const collapseBlankLines = (html: string): string => html.replace(/(\n\s*){3,}/g, "\n\n");

const injectMetaTags = (html: string, meta: Metadata): string => {
  if (!/<head[^>]*>/i.test(html) || !/<\/head>/i.test(html)) {
    return html;
  }
  const cleaned = collapseBlankLines(stripSeoTags(html));
  const htmlTagged = setHtmlLangAttributes(cleaned, meta.htmlLang, meta.htmlDir);
  return htmlTagged.replace(/(<head[^>]*>)/i, `$1\n${buildMetaTags(meta)}`);
};

const buildCanonicalSearch = (url: URL): string => {
  const params = new URLSearchParams(url.search);
  const dropKeys = new Set([
    "prefill",
    "debug",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
  ]);

  for (const key of Array.from(params.keys())) {
    if (dropKeys.has(key) || key.startsWith("utm_")) {
      params.delete(key);
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const parsePathInfo = (pathname: string): {
  normalizedPath: string;
  localeFromPath: SupportedLocale | null;
  basePath: string;
  isLocalizedMarketing: boolean;
} => {
  const normalizedPath = normalizePath(pathname);
  const segments = normalizedPath.split("/").filter(Boolean);

  const maybeLocale = segments[0] || null;
  const localeFromPath = isSupportedLocale(maybeLocale) ? maybeLocale : null;
  const basePath = localeFromPath
    ? normalizePath(`/${segments.slice(1).join("/") || ""}`)
    : normalizedPath;

  return {
    normalizedPath,
    localeFromPath,
    basePath,
    isLocalizedMarketing: isLocalizedMarketingBasePath(basePath),
  };
};

const getBlogLocales = (basePath: string): SupportedLocale[] | null => {
  const match = basePath.match(/^\/blog\/([^/]+)$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return BLOG_LOCALES_BY_SLUG[slug] ?? [DEFAULT_LOCALE];
};

const buildAlternateLinks = (origin: string, basePath: string, locales: SupportedLocale[]): AlternateLink[] => {
  const links: AlternateLink[] = locales.map((locale) => ({
    hreflang: locale,
    href: new URL(buildLocalizedPath(basePath, locale), origin).toString(),
  }));

  const xDefaultLocale = locales.includes(DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : locales[0] ?? DEFAULT_LOCALE;

  links.push({
    hreflang: "x-default",
    href: new URL(buildLocalizedPath(basePath, xDefaultLocale), origin).toString(),
  });

  return links;
};

const buildMetadata = (url: URL): Metadata => {
  const pathInfo = parsePathInfo(url.pathname);
  const canonicalSearch = buildCanonicalSearch(url);
  const blogLocales = getBlogLocales(pathInfo.basePath);

  let effectiveLocale: SupportedLocale = DEFAULT_LOCALE;
  let basePathForMeta = pathInfo.basePath;
  let canonicalPath = pathInfo.normalizedPath;
  let alternateLinks: AlternateLink[] = [];

  if (pathInfo.isLocalizedMarketing) {
    effectiveLocale = pathInfo.localeFromPath ?? DEFAULT_LOCALE;

    const missingLocalizedBlogVariant = Boolean(
      blogLocales && !blogLocales.includes(effectiveLocale),
    );

    if (missingLocalizedBlogVariant) {
      // Keep locale-specific UI on the current path, but canonicalize
      // to the source article locale to avoid duplicate-indexing fallback URLs.
      canonicalPath = buildLocalizedPath(pathInfo.basePath, DEFAULT_LOCALE);
      alternateLinks = buildAlternateLinks(url.origin, pathInfo.basePath, blogLocales ?? [DEFAULT_LOCALE]);
    } else {
      canonicalPath = buildLocalizedPath(pathInfo.basePath, effectiveLocale);
      alternateLinks = buildAlternateLinks(
        url.origin,
        pathInfo.basePath,
        blogLocales ?? SUPPORTED_LOCALES.slice(),
      );
    }
  } else if (pathInfo.localeFromPath && isToolBasePath(pathInfo.basePath)) {
    canonicalPath = pathInfo.basePath;
  }

  const page = getPageDefinition(basePathForMeta, effectiveLocale);
  const title = page.title === SITE_NAME ? SITE_NAME : `${page.title} | ${SITE_NAME}`;
  const canonicalUrl = new URL(canonicalPath + canonicalSearch, url.origin).toString();

  const ogTitleRaw = page.ogTitle || page.title;
  const ogDescriptionRaw = page.ogDescription || page.description;
  const ogTitleFull = ogTitleRaw === SITE_NAME ? SITE_NAME : `${ogTitleRaw} | ${SITE_NAME}`;

  const ogImage = new URL("/api/og/site", url.origin);
  ogImage.searchParams.set("title", ogTitleRaw);
  ogImage.searchParams.set("description", ogDescriptionRaw);
  ogImage.searchParams.set("path", canonicalPath + canonicalSearch);
  if (page.pill) {
    ogImage.searchParams.set("pill", page.pill);
  }
  if (page.blogOgImagePath) {
    ogImage.searchParams.set("blog_image", page.blogOgImagePath);
    ogImage.searchParams.set("blog_rev", BLOG_OG_IMAGE_REVISION);
    ogImage.searchParams.set("blog_tint", page.blogAccentTint || DEFAULT_BLOG_OG_TINT);
    ogImage.searchParams.set("blog_tint_intensity", String(page.blogTintIntensity ?? 60));
  }

  return {
    pageTitle: title,
    description: page.description,
    ogTitle: ogTitleFull,
    ogDescription: ogDescriptionRaw,
    canonicalUrl,
    ogImageUrl: ogImage.toString(),
    ogLogoUrl: new URL("/favicon.svg", url.origin).toString(),
    robots: page.robots || "index,follow,max-image-preview:large",
    alternateLinks,
    htmlLang: effectiveLocale,
    htmlDir: "ltr",
  };
};

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response> => {
  const url = new URL(request.url);
  const baseResponse = await context.next();
  const fallbackResponse = baseResponse.clone();
  const contentType = baseResponse.headers.get("content-type") || "";

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/s/") ||
    url.pathname.startsWith("/trip/")
  ) {
    return baseResponse;
  }

  if (!contentType.includes("text/html")) {
    return baseResponse;
  }

  try {
    const metadata = buildMetadata(url);
    const html = await baseResponse.text();
    const rewrittenHtml = injectMetaTags(html, metadata);
    const headers = new Headers(baseResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", SITE_CACHE_CONTROL);
    headers.delete("content-length");
    headers.delete("etag");

    return new Response(rewrittenHtml, {
      status: baseResponse.status,
      statusText: baseResponse.statusText,
      headers,
    });
  } catch {
    return fallbackResponse;
  }
};
