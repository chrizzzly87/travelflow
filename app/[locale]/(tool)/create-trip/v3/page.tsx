import { redirect } from 'next/navigation';

// Legacy version alias: v3 became the wizard flow.
export default function CreateTripV3Redirect(): never {
    redirect('/create-trip/wizard');
}
