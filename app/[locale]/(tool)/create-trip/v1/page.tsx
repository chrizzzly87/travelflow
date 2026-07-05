import { redirect } from 'next/navigation';

// Legacy version alias: always redirected to the classic create-trip page.
export default function CreateTripV1Redirect(): never {
    redirect('/create-trip');
}
