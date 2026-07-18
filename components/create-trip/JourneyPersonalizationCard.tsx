import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowCounterClockwise,
  Check,
  CircleNotch,
  MagicWand,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  JourneyPersonalizationChange,
} from '../../shared/journeyPersonalization';
import {
  JOURNEY_PERSONALIZATION_MAX_REQUEST_CHARS,
} from '../../shared/journeyPersonalization';
import type { JourneyPersonalizationResult } from '../../services/journeyPersonalizationService';

export interface JourneyPersonalizationCardProps {
  value: string;
  result?: JourneyPersonalizationResult;
  errorCode?: string;
  isLoading: boolean;
  isApplied: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onApply: () => void;
  onUndo: () => void;
  onClear: () => void;
  onExampleSelect: (value: string, index: number) => void;
}

const formatValue = (
  change: JourneyPersonalizationChange,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (change.kind === 'place_role') {
    return translate(`wizard.personalize.roles.${String(change.after)}`);
  }
  if (change.kind === 'max_transfer_minutes') {
    return translate('wizard.personalize.minutes', { count: change.after });
  }
  if (change.kind === 'pace') {
    return translate(`wizard.personalize.paces.${String(change.after)}`);
  }
  if (Array.isArray(change.after)) return change.after.join(' · ');
  return String(change.after);
};

const PersonalizationChangeRow: React.FC<{
  change: JourneyPersonalizationChange;
}> = ({ change }) => {
  const { t } = useTranslation('createTrip');
  const label = change.kind === 'place_role'
    ? change.entity?.name ?? t('wizard.personalize.changeLabels.place_role')
    : t(`wizard.personalize.changeLabels.${change.kind}`);
  return (
    <li className="shape-personalize__change">
      <span><Check size={14} weight="bold" aria-hidden="true" /></span>
      <div>
        <strong>{label}</strong>
        <small>{formatValue(change, t)}</small>
        {change.reason ? <p>{change.reason}</p> : null}
      </div>
    </li>
  );
};

const personalizationChangeKey = (change: JourneyPersonalizationChange): string => (
  change.kind === 'place_role'
    ? `${change.kind}:${change.entity?.entityId ?? 'unknown'}`
    : change.kind
);

export const JourneyPersonalizationCard: React.FC<JourneyPersonalizationCardProps> = ({
  value,
  result,
  errorCode,
  isLoading,
  isApplied,
  onChange,
  onSubmit,
  onApply,
  onUndo,
  onClear,
  onExampleSelect,
}) => {
  const { t } = useTranslation('createTrip');
  const examples = [0, 1, 2].map((index) => t(`wizard.personalize.examples.${index}`));
  const canSubmit = value.trim().length >= 4 && !isLoading;

  return (
    <section className="shape-personalize" aria-labelledby="shape-personalize-title">
      <div className="shape-personalize__intro">
        <span className="shape-personalize__icon"><MagicWand size={23} weight="duotone" /></span>
        <div>
          <span>{t('wizard.personalize.eyebrow')}</span>
          <h3 id="shape-personalize-title">{t('wizard.personalize.title')}</h3>
          <p>{t('wizard.personalize.description')}</p>
        </div>
        <span className="shape-personalize__guard"><ShieldCheck size={16} weight="fill" /> {t('wizard.personalize.guarded')}</span>
      </div>

      <label className="shape-personalize__field" htmlFor="shape-personalize-request">
        <span>{t('wizard.personalize.requestLabel')}</span>
        <textarea
          id="shape-personalize-request"
          value={value}
          maxLength={JOURNEY_PERSONALIZATION_MAX_REQUEST_CHARS}
          rows={3}
          placeholder={t('wizard.personalize.placeholder')}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={isLoading}
        />
        <small>{t('wizard.personalize.requestHint', {
          count: JOURNEY_PERSONALIZATION_MAX_REQUEST_CHARS - value.length,
        })}</small>
      </label>

      <div className="shape-personalize__examples" aria-label={t('wizard.personalize.examplesLabel')}>
        {examples.map((example, index) => (
          <button
            key={example}
            type="button"
            onClick={() => onExampleSelect(example, index)}
            disabled={isLoading}
          >
            <Sparkle size={13} weight="fill" aria-hidden="true" />
            {example}
          </button>
        ))}
      </div>

      <div className="shape-personalize__actions">
        <button
          type="button"
          className="shape-personalize__submit"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-busy={isLoading || undefined}
        >
          {isLoading ? <CircleNotch size={17} className="shape-engine-proof__spinner" /> : <MagicWand size={17} weight="fill" />}
          {isLoading ? t('wizard.personalize.loading') : t('wizard.personalize.submit')}
        </button>
        <span>{t('wizard.personalize.routeLocked')}</span>
      </div>

      {errorCode ? (
        <div className="shape-personalize__message shape-personalize__message--error" role="alert">
          <WarningCircle size={19} weight="fill" aria-hidden="true" />
          <div>
            <strong>{t('wizard.personalize.errorTitle')}</strong>
            <span>{t('wizard.personalize.errorDescription')}</span>
            <small>{errorCode}</small>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="shape-personalize__proposal" aria-live="polite">
          <div className="shape-personalize__proposal-header">
            <div>
              <span>{t('wizard.personalize.proposalEyebrow')}</span>
              <h4>{result.proposal.summary}</h4>
            </div>
            <span data-applied={isApplied ? 'true' : 'false'}>
              {isApplied ? <Check size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
              {isApplied ? t('wizard.personalize.applied') : t('wizard.personalize.ready')}
            </span>
          </div>

          <dl className="shape-personalize__receipt">
            <div><dt>{t('wizard.personalize.receipt.aiCalls')}</dt><dd>1</dd></div>
            <div><dt>{t('wizard.personalize.receipt.model')}</dt><dd>{result.meta.model}</dd></div>
            <div><dt>{t('wizard.personalize.receipt.time')}</dt><dd>{Math.round(result.meta.durationMs)} ms</dd></div>
            <div><dt>{t('wizard.personalize.receipt.dataset')}</dt><dd>{result.request.context.datasetVersion}</dd></div>
          </dl>

          {result.applied.changes.length > 0 ? (
            <ul className="shape-personalize__changes">
              {result.applied.changes.map((change) => (
                <PersonalizationChangeRow
                  key={personalizationChangeKey(change)}
                  change={change}
                />
              ))}
            </ul>
          ) : (
            <p className="shape-personalize__no-changes">{t('wizard.personalize.noChanges')}</p>
          )}

          {result.proposal.unresolved.length > 0 ? (
            <div className="shape-personalize__message">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <div>
                <strong>{t('wizard.personalize.unresolved')}</strong>
                <ul>{result.proposal.unresolved.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : null}
          {result.proposal.cautions.length > 0 ? (
            <div className="shape-personalize__message">
              <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
              <div>
                <strong>{t('wizard.personalize.cautions')}</strong>
                <ul>{result.proposal.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : null}

          <div className="shape-personalize__proposal-actions">
            {isApplied ? (
              <button type="button" onClick={onUndo}>
                <ArrowCounterClockwise size={16} weight="bold" />
                {t('wizard.personalize.undo')}
              </button>
            ) : (
              <button
                type="button"
                className="shape-personalize__apply"
                onClick={onApply}
                disabled={result.applied.changes.length === 0}
              >
                <Check size={16} weight="bold" />
                {t('wizard.personalize.apply', { count: result.applied.changes.length })}
              </button>
            )}
            <button type="button" onClick={onClear}>{t('wizard.personalize.tryAnother')}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
