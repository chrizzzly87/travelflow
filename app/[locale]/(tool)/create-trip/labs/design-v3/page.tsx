import { redirect } from 'next/navigation';

// Legacy lab alias: design-v3 became the wizard flow.
export default function CreateTripDesignV3Redirect(): never {
    redirect('/create-trip/wizard');
}
