import { redirect } from 'next/navigation';

// Legacy: /trip without an id has always redirected to /create-trip.
export default function TripIndexRedirect(): never {
    redirect('/create-trip');
}
