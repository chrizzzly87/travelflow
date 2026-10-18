import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TripsRoute } from '../../../routes/TripsRoute';
import { normalizeLocale } from '../../../config/locales';
export const Route = createFileRoute('/_library/{-$locale}/trips')({ component: TripLibrary });
function TripLibrary() {
 const navigate = useNavigate(); const { i18n } = useTranslation('common');
 return <TripsRoute appLanguage={normalizeLocale(i18n.resolvedLanguage ?? i18n.language)} onAppLanguageLoaded={language => { void i18n.changeLanguage(language); }} onTripLoaded={trip => { void navigate({ to: '/trip/$tripId', params: { tripId: trip.id } }); }} />;
}
