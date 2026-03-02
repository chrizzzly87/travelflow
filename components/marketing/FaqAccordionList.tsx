import React from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { FaqItemWithSection } from '../../data/faqContent';

interface FaqAccordionListProps {
  items: FaqItemWithSection[];
  openItemIds: string[];
  onToggle: (item: FaqItemWithSection, nextOpen: boolean) => void;
  getItemButtonProps?: (item: FaqItemWithSection, isOpen: boolean) => Record<string, string | number | boolean | undefined>;
  renderPanelFooter?: (item: FaqItemWithSection) => React.ReactNode;
  compact?: boolean;
}

export const FaqAccordionList: React.FC<FaqAccordionListProps> = ({
  items,
  openItemIds,
  onToggle,
  getItemButtonProps,
  renderPanelFooter,
  compact = false,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {items.map((item, index) => {
        const isOpen = openItemIds.includes(item.id);
        const panelId = `faq-panel-${item.id}`;
        const triggerId = `faq-trigger-${item.id}`;

        return (
          <div
            key={item.id}
            id={item.id}
            className={`scroll-mt-28 ${index !== items.length - 1 ? 'border-b border-slate-200' : ''}`}
          >
            <button
              id={triggerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => onToggle(item, !isOpen)}
              className={`flex w-full items-center justify-between gap-3 px-4 text-left text-slate-900 transition-colors hover:bg-slate-50 ${
                compact ? 'py-3' : 'py-4'
              }`}
              {...(getItemButtonProps ? getItemButtonProps(item, isOpen) : {})}
            >
              <span className={`font-semibold ${compact ? 'text-sm' : 'text-[1.02rem]'}`}>{item.question}</span>
              <CaretDown
                size={18}
                weight="bold"
                className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className={`px-4 pb-4 text-slate-600 ${compact ? 'text-sm leading-6' : 'text-[0.95rem] leading-7'}`}
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
