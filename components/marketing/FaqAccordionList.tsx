import React from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { FaqItemWithSection } from '../../data/faqContent';

interface FaqAccordionListProps {
  items: FaqItemWithSection[];
  openItemIds: string[];
  onToggle: (item: FaqItemWithSection, nextOpen: boolean) => void;
  getItemButtonProps?: (item: FaqItemWithSection, isOpen: boolean) => Record<string, string | number | boolean | undefined>;
  renderPanelFooter?: (item: FaqItemWithSection) => React.ReactNode;
  variant?: 'card' | 'plain';
  compact?: boolean;
}

export const FaqAccordionList: React.FC<FaqAccordionListProps> = ({
  items,
  openItemIds,
  onToggle,
  getItemButtonProps,
  renderPanelFooter,
  variant = 'card',
  compact = false,
}) => {
  const isPlain = variant === 'plain';

  return (
    <div className={isPlain ? '' : 'rounded-2xl border border-border bg-card dark:border-border dark:bg-card'}>
      {items.map((item, index) => {
        const isOpen = openItemIds.includes(item.id);
        const panelId = `faq-panel-${item.id}`;
        const triggerId = `faq-trigger-${item.id}`;

        return (
          <div
            key={item.id}
            id={item.id}
            className={`scroll-mt-28 border-b border-border ${index === items.length - 1 ? 'border-b-0' : ''}`}
          >
            <button
              id={triggerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => onToggle(item, !isOpen)}
              className={`flex w-full items-center justify-between gap-3 text-left text-foreground transition-colors ${
                isPlain ? 'hover:text-foreground dark:hover:text-foreground' : 'hover:bg-secondary dark:hover:bg-secondary'
              } ${
                compact ? 'py-3' : 'py-4'
              }`}
              style={isPlain ? { paddingInline: 0 } : undefined}
              {...(getItemButtonProps ? getItemButtonProps(item, isOpen) : {})}
            >
              <span className={`max-w-[100ch] font-semibold ${isOpen ? 'text-accent-700 dark:text-accent-200' : ''} ${compact ? 'text-sm' : 'text-[1.02rem]'}`}>
                {item.question}
              </span>
              <CaretDown
                size={18}
                weight="bold"
                className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className={`max-w-[100ch] pb-4 text-muted-foreground ${compact ? 'text-sm leading-6' : 'text-[0.95rem] leading-7'}`}
                style={isPlain ? { paddingInline: 0 } : { paddingInline: '1rem' }}
              >
                <p>{item.answer}</p>
                {renderPanelFooter ? (
                  <div className="mt-3">
                    {renderPanelFooter(item)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
