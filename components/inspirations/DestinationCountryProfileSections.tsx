import React from 'react';
import {
  Car,
  CellSignalFull,
  ClockCounterClockwise,
  CloudSun,
  CreditCard,
  FirstAid,
  Info,
  Lightning,
  PhoneCall,
  PlugsConnected,
  ShieldCheck,
  Sun,
  Umbrella,
  WarningCircle,
  WifiHigh,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../types';
import type { DestinationCountryProfileResult } from '../../shared/destinationCountryProfile';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

interface DestinationCountryProfileSectionsProps {
  countryName: string;
  locale: AppLanguage;
  result: DestinationCountryProfileResult;
}

interface InfoCardProps {
  icon: React.ComponentType<{ size?: number; weight?: 'duotone'; className?: string }>;
  title: string;
  children: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon: Icon, title, children }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
      <Icon size={19} weight="duotone" className="text-accent-700" />
      {title}
    </h3>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
  </article>
);

const Fact: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => value ? (
  <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
    <span className="text-slate-500">{label}</span>
    <span className="text-end font-bold text-slate-800">{value}</span>
  </div>
) : null;

const TipList: React.FC<{ items?: string[] }> = ({ items = [] }) => items.length > 0 ? (
  <ul className="space-y-2">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-500" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
) : null;

const formatTemperature = (value: number): string => `${Math.round(value)}°`;

export const DestinationCountryProfileSections: React.FC<DestinationCountryProfileSectionsProps> = ({
  countryName,
  locale,
  result,
}) => {
  const { t } = useTranslation('pages');
  const { profile, provenance } = result;
  const sections = profile.sections;
  const entry = sections.entry_requirements;
  const health = sections.health_info;
  const driving = sections.driving_info;
  const cards = sections.card_info;
  const tipping = sections.tipping_info;
  const mobile = sections.mobile_info;
  const electrical = sections.electrical_info;
  const internet = sections.internet_info;
  const emergency = sections.emergency_info;
  const embassy = sections.embassy_info;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <>
      {profile.alertMessage ? (
        <section className="pb-8 animate-hero-stagger" style={{ '--stagger': '100ms' } as React.CSSProperties}>
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <WarningCircle className="mt-0.5 shrink-0 text-amber-700" size={22} weight="duotone" />
            <div>
              <h2 className="font-black">{t('inspirations.subpages.guide.travelAlert')}</h2>
              <p className="mt-1 text-sm leading-relaxed">{profile.alertMessage}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '120ms' } as React.CSSProperties}>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.atAGlanceEyebrow')}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.atAGlance')}</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Fact label={t('inspirations.subpages.guide.currency')} value={profile.currencyCode || undefined} />
              <Fact
                label={t('inspirations.subpages.guide.exchangeRate')}
                value={profile.exchange.rate && profile.exchange.base && profile.currencyCode
                  ? `1 ${profile.exchange.base} ≈ ${profile.exchange.rate.toFixed(2)} ${profile.currencyCode}`
                  : undefined}
              />
              <Fact label={t('inspirations.subpages.guide.timezone')} value={profile.timezone || undefined} />
              <Fact label={t('inspirations.subpages.guide.callingCode')} value={profile.callingCode ? `+${profile.callingCode}` : undefined} />
            </div>
          </div>
          {profile.weather.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-black text-slate-900"><CloudSun size={19} weight="duotone" className="text-accent-700" />{t('inspirations.subpages.guide.weather')}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {profile.weather.slice(0, 5).map((day) => (
                  <div key={day.date} className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs font-bold uppercase text-slate-500">{day.day}</p>
                    <p className="mt-1 font-black text-slate-900">{formatTemperature(day.max_temp)}</p>
                    <p className="text-xs text-slate-500">{formatTemperature(day.min_temp)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{day.condition}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '170ms' } as React.CSSProperties}>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.beforeYouGoEyebrow')}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.beforeYouGo')}</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {entry?.tips?.length ? (
            <InfoCard icon={Info} title={t('inspirations.subpages.guide.entryRequirements')}>
              <p className="rounded-xl bg-slate-50 p-3 font-semibold text-slate-700">{t('inspirations.subpages.guide.ukTravellerContext')}</p>
              <TipList items={entry.tips} />
              {entry.bonus_tips?.length ? (
                <div className="rounded-xl bg-accent-50 p-3 text-accent-950">
                  <p className="mb-2 font-bold">{t('inspirations.subpages.guide.goodToKnow')}</p>
                  <TipList items={entry.bonus_tips} />
                </div>
              ) : null}
              {entry.source_url ? (
                <a
                  href={entry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('inspirations__destination_source', { country: countryName, section: 'entry_requirements' })}
                  className="inline-flex font-bold text-accent-700 underline decoration-accent-200 underline-offset-4 hover:text-accent-900"
                  {...getAnalyticsDebugAttributes('inspirations__destination_source', { country: countryName, section: 'entry_requirements' })}
                >
                  {t('inspirations.subpages.guide.checkOfficialAdvice')}
                </a>
              ) : null}
            </InfoCard>
          ) : null}
          {profile.safetyTips.length > 0 ? (
            <InfoCard icon={ShieldCheck} title={t('inspirations.subpages.guide.safety')}>
              <TipList items={profile.safetyTips} />
              {profile.bonusTips.length > 0 ? (
                <div className="rounded-xl bg-slate-50 p-3"><TipList items={profile.bonusTips} /></div>
              ) : null}
            </InfoCard>
          ) : null}
        </div>
      </section>

      <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '220ms' } as React.CSSProperties}>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.practicalEyebrow')}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.practicalInfo')}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health ? (
            <InfoCard icon={FirstAid} title={t('inspirations.subpages.guide.health')}>
              {health.insuranceSummary ? <p>{health.insuranceSummary}</p> : null}
              {health.summary ? <p>{health.summary}</p> : null}
              <Fact label={t('inspirations.subpages.guide.vaccinationRequired')} value={health.vaccinationRequired ? t('inspirations.subpages.guide.yes') : t('inspirations.subpages.guide.no')} />
            </InfoCard>
          ) : null}
          {driving ? (
            <InfoCard icon={Car} title={t('inspirations.subpages.guide.driving')}>
              {driving.licenseRequirement ? <p>{driving.licenseRequirement}</p> : null}
              <Fact label={t('inspirations.subpages.guide.roadSide')} value={driving.side} />
              <Fact label={t('inspirations.subpages.guide.urbanSpeed')} value={driving.speedLimitUrban} />
              <Fact label={t('inspirations.subpages.guide.motorwaySpeed')} value={driving.speedLimitMotorway} />
              <Fact label={t('inspirations.subpages.guide.alcoholLimit')} value={driving.alcoholLimit} />
            </InfoCard>
          ) : null}
          {cards ? (
            <InfoCard icon={CreditCard} title={t('inspirations.subpages.guide.cardsPayments')}>
              {cards.acceptance ? <p>{cards.acceptance}</p> : null}
              {cards.brands?.map((brand) => <Fact key={brand.name} label={brand.name} value={brand.acceptance} />)}
            </InfoCard>
          ) : null}
          {tipping ? (
            <InfoCard icon={Umbrella} title={t('inspirations.subpages.guide.tipping')}>
              {tipping.summary ? <p>{tipping.summary}</p> : null}
              {tipping.categories?.map((category) => <Fact key={category.category} label={category.category} value={category.amount} />)}
            </InfoCard>
          ) : null}
          {mobile ? (
            <InfoCard icon={CellSignalFull} title={t('inspirations.subpages.guide.mobileRoaming')}>
              {mobile.roamingInfo ? <p>{mobile.roamingInfo}</p> : null}
              <Fact label={t('inspirations.subpages.guide.localSim')} value={mobile.dataPackage?.size && mobile.dataPackage.price ? `${mobile.dataPackage.size} · ${mobile.dataPackage.price}` : undefined} />
              <Fact label={t('inspirations.subpages.guide.networks')} value={mobile.networkTypes?.join(', ')} />
            </InfoCard>
          ) : null}
          {electrical ? (
            <InfoCard icon={PlugsConnected} title={t('inspirations.subpages.guide.electrical')}>
              <Fact label={t('inspirations.subpages.guide.voltage')} value={[electrical.voltage, electrical.frequency].filter(Boolean).join(' · ')} />
              <Fact label={t('inspirations.subpages.guide.plugTypes')} value={electrical.plugTypes?.join(', ')} />
              <Fact label={t('inspirations.subpages.guide.ukAdapterNeeded')} value={electrical.ukAdapterNeeded ? t('inspirations.subpages.guide.yes') : t('inspirations.subpages.guide.no')} />
            </InfoCard>
          ) : null}
          {internet ? (
            <InfoCard icon={WifiHigh} title={t('inspirations.subpages.guide.internet')}>
              {internet.wifiCoverage ? <p>{internet.wifiCoverage}</p> : null}
              {internet.summary ? <p>{internet.summary}</p> : null}
              <Fact label={t('inspirations.subpages.guide.averageSpeed')} value={internet.averageSpeed} />
            </InfoCard>
          ) : null}
          {emergency ? (
            <InfoCard icon={PhoneCall} title={t('inspirations.subpages.guide.emergencyNumbers')}>
              {Object.entries(emergency).map(([label, value]) => <Fact key={label} label={t(`inspirations.subpages.guide.emergency.${label}`, { defaultValue: label })} value={value} />)}
            </InfoCard>
          ) : null}
          {sections.spf_recommendations ? (
            <InfoCard icon={Sun} title={t('inspirations.subpages.guide.sunProtection')}>
              {Object.entries(sections.spf_recommendations).map(([season, recommendation]) => <Fact key={season} label={season} value={recommendation} />)}
            </InfoCard>
          ) : null}
          {embassy ? (
            <InfoCard icon={Lightning} title={t('inspirations.subpages.guide.embassy')}>
              {embassy.name ? <p className="font-bold text-slate-800">{embassy.name}</p> : null}
              {embassy.address ? <p className="whitespace-pre-line">{embassy.address}</p> : null}
              <Fact label={t('inspirations.subpages.guide.phone')} value={embassy.phone} />
              {embassy.website ? (
                <a
                  href={embassy.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('inspirations__destination_source', { country: countryName, section: 'embassy' })}
                  className="font-bold text-accent-700 underline decoration-accent-200 underline-offset-4 hover:text-accent-900"
                  {...getAnalyticsDebugAttributes('inspirations__destination_source', { country: countryName, section: 'embassy' })}
                >{t('inspirations.subpages.guide.visitWebsite')}</a>
              ) : null}
            </InfoCard>
          ) : null}
        </div>
      </section>

      {profile.beaches.length > 0 ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '260ms' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.coastEyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.beaches')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.beaches.slice(0, 18).map((beach) => (
              <span key={beach.name} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-900">{beach.name}</span>
            ))}
          </div>
        </section>
      ) : null}

      {profile.faqs.length > 0 ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '280ms' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.faqEyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.faq')}</h2>
          </div>
          <div className="space-y-3">
            {profile.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none font-black text-slate-900 marker:hidden">{faq.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {profile.recentUpdates.length > 0 ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '300ms' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.freshnessEyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.recentUpdates')}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {profile.recentUpdates.map((update, index) => (
              <article key={`${update.timestamp || 'update'}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-700">
                  <ClockCounterClockwise size={16} weight="duotone" />
                  {update.category || t('inspirations.subpages.guide.travelUpdate')}
                </p>
                {update.timestamp ? <p className="mt-2 text-xs text-slate-500">{dateFormatter.format(new Date(update.timestamp))}</p> : null}
                <div className="mt-3"><TipList items={update.messages} /></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {provenance ? (
        <section className="pb-10 text-xs leading-relaxed text-slate-500">
          <p>
            {t('inspirations.subpages.guide.sourceAttribution')}{' '}
            <a
              href={provenance.originUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('inspirations__destination_source', { country: countryName, section: 'profile_origin' })}
              className="font-bold underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
              {...getAnalyticsDebugAttributes('inspirations__destination_source', { country: countryName, section: 'profile_origin' })}
            >{provenance.provider}</a>
            {' · '}{t('inspirations.subpages.guide.fetchedOn', { date: dateFormatter.format(new Date(provenance.fetchedAt)) })}
          </p>
        </section>
      ) : null}
    </>
  );
};
