import LZString from 'lz-string';
import { ITrip, ITimelineItem } from './types';

export const BASE_PIXELS_PER_DAY = 120; // Width of one day column (Base Zoom 1.0)
export const PIXELS_PER_DAY = BASE_PIXELS_PER_DAY; // Deprecated: Use prop passed from parent for zooming

// --- API KEY MANAGEMENT ---

export const getApiKey = (): string => {
    let key = '';
    
    // 1. Try standard Node/Webpack process.env
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            key = process.env.API_KEY;
        }
    } catch (e) {}

    // 2. Try Vite import.meta.env
    if (!key) {
        try {
            // @ts-ignore
            if (import.meta && import.meta.env) {
                // @ts-ignore
                key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY || '';
            }
        } catch (e) {}
    }

    // 3. Try Window global fallback
    if (!key && typeof window !== 'undefined') {
        const win = window as any;
        key = win.GOOGLE_API_KEY || (win.process && win.process.env && win.process.env.API_KEY) || '';
    }

    // Sanitize: Remove quotes, whitespace
    if (key) {
        key = String(key).replace(/['";]/g, '').trim();
    }

    // 4. CHECK FOR INVALID PLACEHOLDERS & APPLY INLINE FALLBACK
    // If the key is missing, empty, or equals common build placeholders, use the fallback.
    const invalidKeys = [
        'UNUSED_PLACEHOLDER_FOR_API_KEY', 
        'undefined', 
        'null', 
        'YOUR_API_KEY', 
        'ProcessEnv.API_KEY',
        ''
    ];
    
    // Check if key is in invalid list or too short to be real
    if (!key || key.length < 10 || invalidKeys.some(k => key.includes(k))) {
        // Never inline secrets in source; rely on environment configuration.
        return "";
    }
    
    return key;
};

// Singleton promise to handle Google Maps loading status
let googleMapsPromise: Promise<void> | null = null;

export const loadGoogleMapsApi = (): Promise<void> => {
    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error("Window is undefined"));
            return;
        }

        // Check if already loaded
        if ((window as any).google?.maps?.places) {
            resolve();
            return;
        }

        // Check if script is already in DOM (prevent duplicates)
        if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
             // Polling to wait for it to be ready
             const interval = setInterval(() => {
                if ((window as any).google?.maps?.places) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 8 seconds
            setTimeout(() => {
                clearInterval(interval);
                // If it's still not loaded, resolve anyway to allow app to continue without map search
                console.warn("Google Maps script detected but object not ready (Timeout)");
                resolve(); 
            }, 8000);
            return;
        }

        const apiKey = getApiKey();
        
        // Construct script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
             // Wait for the global object to be populated
             const check = setInterval(() => {
                 if ((window as any).google?.maps?.places) {
                     clearInterval(check);
                     resolve();
                 }
             }, 100);
             
             // Timeout safety
             setTimeout(() => {
                 clearInterval(check);
                 resolve(); 
             }, 3000);
        };
        
        script.onerror = (e) => {
            console.error("Google Maps Script Error:", e);
            // Don't reject hard, just log, so app doesn't crash on startup
            resolve();
        };
        
        document.head.appendChild(script);
    });

    return googleMapsPromise;
};

// --- HELPERS ---

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysDifference = (start: string, end: string): number => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
};

export const getTripDuration = (items: any[]): number => {
  if (items.length === 0) return 14; // Default view
  let maxEnd = 0;
  items.forEach(item => {
    const end = item.startDateOffset + item.duration;
    if (end > maxEnd) maxEnd = end;
  });
  return Math.max(maxEnd + 2, 10); // Add some buffer
};

export const getDefaultTripDates = () => {
    const today = new Date();
    // 3 months in future
    const target = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    
    // Find next Friday (0=Sun, 5=Fri)
    const day = target.getDay();
    const diff = (5 - day + 7) % 7;
    target.setDate(target.getDate() + diff);
    
    const start = target;
    const end = new Date(start);
    // "Two weeks long, Friday until Saturday" implies ~15/16 days (3 weekends)
    end.setDate(start.getDate() + 15); 
    
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
};

// --- Dynamic Title Generation ---
export const generateTripTitle = (trip: ITrip): string => {
    const cities = trip.items.filter(i => i.type === 'city');
    if (cities.length === 0) return "New Trip";

    const baseTitle = trip.title.split('(')[0].trim();
    
    const start = new Date(trip.startDate);
    const end = addDays(start, getTripDuration(trip.items)); // Approx duration
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    
    const monthStr = startMonth === endMonth ? startMonth : `${startMonth}-${endMonth}`;
    const totalDays = Math.ceil(getTripDuration(trip.items));

    // Avoid duplicate suffix
    if (trip.title.includes(`(${monthStr}`)) return trip.title;

    return `${baseTitle} (${monthStr}, ${totalDays} Days)`;
};

// URL State Management
export const compressTripToUrl = (trip: ITrip): string => {
    const json = JSON.stringify(trip);
    return LZString.compressToEncodedURIComponent(json);
};

export const decompressTripFromUrl = (hash: string): ITrip | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(hash);
        if (!json) return null;
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to decompress trip", e);
        return null;
    }
};

// --- COLOR PALETTE DEFINITION ---

export interface ColorDefinition {
    name: string;
    class: string; // Tailwind string
    hex: string;   // Hex code for Map/Canvas
}

export const PRESET_COLORS: ColorDefinition[] = [
    { name: 'Rose', class: 'bg-rose-200 border-rose-300 text-rose-900', hex: '#f43f5e' },
    { name: 'Orange', class: 'bg-orange-200 border-orange-300 text-orange-900', hex: '#f97316' },
    { name: 'Amber', class: 'bg-amber-200 border-amber-300 text-amber-900', hex: '#d97706' },
    { name: 'Emerald', class: 'bg-emerald-200 border-emerald-300 text-emerald-900', hex: '#059669' },
    { name: 'Teal', class: 'bg-teal-200 border-teal-300 text-teal-900', hex: '#0d9488' },
    { name: 'Cyan', class: 'bg-cyan-200 border-cyan-300 text-cyan-900', hex: '#0891b2' },
    { name: 'Sky', class: 'bg-sky-200 border-sky-300 text-sky-900', hex: '#0284c7' },
    { name: 'Indigo', class: 'bg-indigo-200 border-indigo-300 text-indigo-900', hex: '#4f46e5' },
    { name: 'Violet', class: 'bg-violet-200 border-violet-300 text-violet-900', hex: '#7c3aed' },
    { name: 'Fuchsia', class: 'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900', hex: '#c026d3' },
    { name: 'Slate', class: 'bg-slate-200 border-slate-300 text-slate-900', hex: '#475569' },
    { name: 'Lime', class: 'bg-lime-200 border-lime-300 text-lime-900', hex: '#65a30d' },
];

export const CITY_COLORS = PRESET_COLORS.map(c => c.class);

export const ACTIVITY_COLORS = [
  'bg-slate-100 border-slate-300 text-slate-800',
  'bg-gray-100 border-gray-300 text-gray-800',
  'bg-zinc-100 border-zinc-300 text-zinc-800',
];

export const TRAVEL_COLOR = 'bg-stone-800 border-stone-600 text-stone-100';
export const TRAVEL_EMPTY_COLOR = 'bg-white border-dashed border-stone-300 text-stone-400';

export const getRandomCityColor = (index: number) => CITY_COLORS[index % CITY_COLORS.length];
export const getRandomActivityColor = () => ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)];

// Helper to find Hex from Tailwind Class string
export const getHexFromColorClass = (colorClass: string): string => {
    const match = PRESET_COLORS.find(c => c.class === colorClass);
    return match ? match.hex : '#4f46e5'; // Default indigo
};

// Comprehensive Countries Data
export const COUNTRIES = [
    { name: "Afghanistan", code: "AF", flag: "🇦🇫" },
    { name: "Albania", code: "AL", flag: "🇦🇱" },
    { name: "Algeria", code: "DZ", flag: "🇩🇿" },
    { name: "Andorra", code: "AD", flag: "🇦🇩" },
    { name: "Angola", code: "AO", flag: "🇦🇴" },
    { name: "Antigua and Barbuda", code: "AG", flag: "🇦🇬" },
    { name: "Argentina", code: "AR", flag: "🇦🇷" },
    { name: "Armenia", code: "AM", flag: "🇦🇲" },
    { name: "Australia", code: "AU", flag: "🇦🇺" },
    { name: "Austria", code: "AT", flag: "🇦🇹" },
    { name: "Azerbaijan", code: "AZ", flag: "🇦🇿" },
    { name: "Bahamas", code: "BS", flag: "🇧🇸" },
    { name: "Bahrain", code: "BH", flag: "🇧🇭" },
    { name: "Bangladesh", code: "BD", flag: "🇧🇩" },
    { name: "Barbados", code: "BB", flag: "🇧🇧" },
    { name: "Belarus", code: "BY", flag: "🇧🇾" },
    { name: "Belgium", code: "BE", flag: "🇧🇪" },
    { name: "Belize", code: "BZ", flag: "🇧🇿" },
    { name: "Benin", code: "BJ", flag: "🇧🇯" },
    { name: "Bhutan", code: "BT", flag: "🇧🇹" },
    { name: "Bolivia", code: "BO", flag: "🇧🇴" },
    { name: "Bosnia and Herzegovina", code: "BA", flag: "🇧🇦" },
    { name: "Botswana", code: "BW", flag: "🇧🇼" },
    { name: "Brazil", code: "BR", flag: "🇧🇷" },
    { name: "Brunei", code: "BN", flag: "🇧🇳" },
    { name: "Bulgaria", code: "BG", flag: "🇧🇬" },
    { name: "Burkina Faso", code: "BF", flag: "🇧🇫" },
    { name: "Burundi", code: "BI", flag: "🇧🇮" },
    { name: "Cambodia", code: "KH", flag: "🇰🇭" },
    { name: "Cameroon", code: "CM", flag: "🇨🇲" },
    { name: "Canada", code: "CA", flag: "🇨🇦" },
    { name: "Cape Verde", code: "CV", flag: "🇨🇻" },
    { name: "Central African Republic", code: "CF", flag: "🇨🇫" },
    { name: "Chad", code: "TD", flag: "🇹🇩" },
    { name: "Chile", code: "CL", flag: "🇨🇱" },
    { name: "China", code: "CN", flag: "🇨🇳" },
    { name: "Colombia", code: "CO", flag: "🇨🇴" },
    { name: "Comoros", code: "KM", flag: "🇰🇲" },
    { name: "Congo (Democratic Republic)", code: "CD", flag: "🇨🇩" },
    { name: "Congo (Republic)", code: "CG", flag: "🇨🇬" },
    { name: "Costa Rica", code: "CR", flag: "🇨🇷" },
    { name: "Croatia", code: "HR", flag: "🇭🇷" },
    { name: "Cuba", code: "CU", flag: "🇨🇺" },
    { name: "Cyprus", code: "CY", flag: "🇨🇾" },
    { name: "Czech Republic", code: "CZ", flag: "🇨🇿" },
    { name: "Denmark", code: "DK", flag: "🇩🇰" },
    { name: "Djibouti", code: "DJ", flag: "🇩🇯" },
    { name: "Dominica", code: "DM", flag: "🇩🇲" },
    { name: "Dominican Republic", code: "DO", flag: "🇩🇴" },
    { name: "East Timor", code: "TL", flag: "🇹🇱" },
    { name: "Ecuador", code: "EC", flag: "🇪🇨" },
    { name: "Egypt", code: "EG", flag: "🇪🇬" },
    { name: "El Salvador", code: "SV", flag: "🇸🇻" },
    { name: "Equatorial Guinea", code: "GQ", flag: "🇬🇶" },
    { name: "Eritrea", code: "ER", flag: "🇪🇷" },
    { name: "Estonia", code: "EE", flag: "🇪🇪" },
    { name: "Eswatini", code: "SZ", flag: "🇸🇿" },
    { name: "Ethiopia", code: "ET", flag: "🇪🇹" },
    { name: "Fiji", code: "FJ", flag: "🇫🇯" },
    { name: "Finland", code: "FI", flag: "🇫🇮" },
    { name: "France", code: "FR", flag: "🇫🇷" },
    { name: "Gabon", code: "GA", flag: "🇬🇦" },
    { name: "Gambia", code: "GM", flag: "🇬🇲" },
    { name: "Georgia", code: "GE", flag: "🇬🇪" },
    { name: "Germany", code: "DE", flag: "🇩🇪" },
    { name: "Ghana", code: "GH", flag: "🇬🇭" },
    { name: "Greece", code: "GR", flag: "🇬🇷" },
    { name: "Grenada", code: "GD", flag: "🇬🇩" },
    { name: "Guatemala", code: "GT", flag: "🇬🇹" },
    { name: "Guinea", code: "GN", flag: "🇬🇳" },
    { name: "Guinea-Bissau", code: "GW", flag: "🇬🇼" },
    { name: "Guyana", code: "GY", flag: "🇬🇾" },
    { name: "Haiti", code: "HT", flag: "🇭🇹" },
    { name: "Honduras", code: "HN", flag: "🇭🇳" },
    { name: "Hungary", code: "HU", flag: "🇭🇺" },
    { name: "Iceland", code: "IS", flag: "🇮🇸" },
    { name: "India", code: "IN", flag: "🇮🇳" },
    { name: "Indonesia", code: "ID", flag: "🇮🇩" },
    { name: "Iran", code: "IR", flag: "🇮🇷" },
    { name: "Iraq", code: "IQ", flag: "🇮🇶" },
    { name: "Ireland", code: "IE", flag: "🇮🇪" },
    { name: "Israel", code: "IL", flag: "🇮🇱" },
    { name: "Italy", code: "IT", flag: "🇮🇹" },
    { name: "Ivory Coast", code: "CI", flag: "🇨🇮" },
    { name: "Jamaica", code: "JM", flag: "🇯🇲" },
    { name: "Japan", code: "JP", flag: "🇯🇵" },
    { name: "Jordan", code: "JO", flag: "🇯🇴" },
    { name: "Kazakhstan", code: "KZ", flag: "🇰🇿" },
    { name: "Kenya", code: "KE", flag: "🇰🇪" },
    { name: "Kiribati", code: "KI", flag: "🇰🇮" },
    { name: "Kosovo", code: "XK", flag: "🇽🇰" },
    { name: "Kuwait", code: "KW", flag: "🇰🇼" },
    { name: "Kyrgyzstan", code: "KG", flag: "🇰🇬" },
    { name: "Laos", code: "LA", flag: "🇱🇦" },
    { name: "Latvia", code: "LV", flag: "🇱🇻" },
    { name: "Lebanon", code: "LB", flag: "🇱🇧" },
    { name: "Lesotho", code: "LS", flag: "🇱🇸" },
    { name: "Liberia", code: "LR", flag: "🇱🇷" },
    { name: "Libya", code: "LY", flag: "🇱🇾" },
    { name: "Liechtenstein", code: "LI", flag: "🇱🇮" },
    { name: "Lithuania", code: "LT", flag: "🇱🇹" },
    { name: "Luxembourg", code: "LU", flag: "🇱🇺" },
    { name: "Madagascar", code: "MG", flag: "🇲🇬" },
    { name: "Malawi", code: "MW", flag: "🇲🇼" },
    { name: "Malaysia", code: "MY", flag: "🇲🇾" },
    { name: "Maldives", code: "MV", flag: "🇲🇻" },
    { name: "Mali", code: "ML", flag: "🇲🇱" },
    { name: "Malta", code: "MT", flag: "🇲🇹" },
    { name: "Marshall Islands", code: "MH", flag: "🇲🇭" },
    { name: "Mauritania", code: "MR", flag: "🇲🇷" },
    { name: "Mauritius", code: "MU", flag: "🇲🇺" },
    { name: "Mexico", code: "MX", flag: "🇲🇽" },
    { name: "Micronesia", code: "FM", flag: "🇫🇲" },
    { name: "Moldova", code: "MD", flag: "🇲🇩" },
    { name: "Monaco", code: "MC", flag: "🇲🇨" },
    { name: "Mongolia", code: "MN", flag: "🇲🇳" },
    { name: "Montenegro", code: "ME", flag: "🇲🇪" },
    { name: "Morocco", code: "MA", flag: "🇲🇦" },
    { name: "Mozambique", code: "MZ", flag: "🇲🇿" },
    { name: "Myanmar", code: "MM", flag: "🇲🇲" },
    { name: "Namibia", code: "NA", flag: "🇳🇦" },
    { name: "Nauru", code: "NR", flag: "🇳🇷" },
    { name: "Nepal", code: "NP", flag: "🇳🇵" },
    { name: "Netherlands", code: "NL", flag: "🇳🇱" },
    { name: "New Zealand", code: "NZ", flag: "🇳🇿" },
    { name: "Nicaragua", code: "NI", flag: "🇳🇮" },
    { name: "Niger", code: "NE", flag: "🇳🇪" },
    { name: "Nigeria", code: "NG", flag: "🇳🇬" },
    { name: "North Korea", code: "KP", flag: "🇰🇵" },
    { name: "North Macedonia", code: "MK", flag: "🇲🇰" },
    { name: "Norway", code: "NO", flag: "🇳🇴" },
    { name: "Oman", code: "OM", flag: "🇴🇲" },
    { name: "Pakistan", code: "PK", flag: "🇵🇰" },
    { name: "Palau", code: "PW", flag: "🇵🇼" },
    { name: "Palestine", code: "PS", flag: "🇵🇸" },
    { name: "Panama", code: "PA", flag: "🇵🇦" },
    { name: "Papua New Guinea", code: "PG", flag: "🇵🇬" },
    { name: "Paraguay", code: "PY", flag: "🇵🇾" },
    { name: "Peru", code: "PE", flag: "🇵🇪" },
    { name: "Philippines", code: "PH", flag: "🇵🇭" },
    { name: "Poland", code: "PL", flag: "🇵🇱" },
    { name: "Portugal", code: "PT", flag: "🇵🇹" },
    { name: "Qatar", code: "QA", flag: "🇶🇦" },
    { name: "Romania", code: "RO", flag: "🇷🇴" },
    { name: "Russia", code: "RU", flag: "🇷🇺" },
    { name: "Rwanda", code: "RW", flag: "🇷🇼" },
    { name: "Saint Kitts and Nevis", code: "KN", flag: "🇰🇳" },
    { name: "Saint Lucia", code: "LC", flag: "🇱🇨" },
    { name: "Saint Vincent and the Grenadines", code: "VC", flag: "🇻🇨" },
    { name: "Samoa", code: "WS", flag: "🇼🇸" },
    { name: "San Marino", code: "SM", flag: "🇸🇲" },
    { name: "Sao Tome and Principe", code: "ST", flag: "🇸🇹" },
    { name: "Saudi Arabia", code: "SA", flag: "🇸🇦" },
    { name: "Senegal", code: "SN", flag: "🇸🇳" },
    { name: "Serbia", code: "RS", flag: "🇷🇸" },
    { name: "Seychelles", code: "SC", flag: "🇸🇨" },
    { name: "Sierra Leone", code: "SL", flag: "🇸🇱" },
    { name: "Singapore", code: "SG", flag: "🇸🇬" },
    { name: "Slovakia", code: "SK", flag: "🇸🇰" },
    { name: "Slovenia", code: "SI", flag: "🇸🇮" },
    { name: "Solomon Islands", code: "SB", flag: "🇸🇧" },
    { name: "Somalia", code: "SO", flag: "🇸🇴" },
    { name: "South Africa", code: "ZA", flag: "🇿🇦" },
    { name: "South Korea", code: "KR", flag: "🇰🇷" },
    { name: "South Sudan", code: "SS", flag: "🇸🇸" },
    { name: "Spain", code: "ES", flag: "🇪🇸" },
    { name: "Sri Lanka", code: "LK", flag: "🇱🇰" },
    { name: "Sudan", code: "SD", flag: "🇸🇩" },
    { name: "Suriname", code: "SR", flag: "🇸🇷" },
    { name: "Sweden", code: "SE", flag: "🇸🇪" },
    { name: "Switzerland", code: "CH", flag: "🇨🇭" },
    { name: "Syria", code: "SY", flag: "🇸🇾" },
    { name: "Taiwan", code: "TW", flag: "🇹🇼" },
    { name: "Tajikistan", code: "TJ", flag: "🇹🇯" },
    { name: "Tanzania", code: "TZ", flag: "🇹🇿" },
    { name: "Thailand", code: "TH", flag: "🇹🇭" },
    { name: "Togo", code: "TG", flag: "🇹🇬" },
    { name: "Tonga", code: "TO", flag: "🇹🇴" },
    { name: "Trinidad and Tobago", code: "TT", flag: "🇹🇹" },
    { name: "Tunisia", code: "TN", flag: "🇹🇳" },
    { name: "Turkey", code: "TR", flag: "🇹🇷" },
    { name: "Turkmenistan", code: "TM", flag: "🇹🇲" },
    { name: "Tuvalu", code: "TV", flag: "🇹🇻" },
    { name: "Uganda", code: "UG", flag: "🇺🇬" },
    { name: "Ukraine", code: "UA", flag: "🇺🇦" },
    { name: "United Arab Emirates", code: "AE", flag: "🇦🇪" },
    { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
    { name: "United States", code: "US", flag: "🇺🇸" },
    { name: "Uruguay", code: "UY", flag: "🇺🇾" },
    { name: "Uzbekistan", code: "UZ", flag: "🇺🇿" },
    { name: "Vanuatu", code: "VU", flag: "🇻🇺" },
    { name: "Vatican City", code: "VA", flag: "🇻🇦" },
    { name: "Venezuela", code: "VE", flag: "🇻🇪" },
    { name: "Vietnam", code: "VN", flag: "🇻🇳" },
    { name: "Yemen", code: "YE", flag: "🇾🇪" },
    { name: "Zambia", code: "ZM", flag: "🇿🇲" },
    { name: "Zimbabwe", code: "ZW", flag: "🇿🇼" }
];
