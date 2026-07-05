import { redirect } from 'next/navigation';

// Legacy lab alias: always redirected to the classic create-trip page.
export default function CreateTripClassicLegacyRedirect(): never {
    redirect('/create-trip');
}
