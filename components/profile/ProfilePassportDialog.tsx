import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { getPassportCoverTheme } from '../../services/passportService';
import { ProfileStampBookViewer } from './ProfileStampBookViewer';
import type { ProfileStampGroup, ProfileStampProgress } from './profileStamps';

interface ProfilePassportDialogLabels {
  pageIndicator: string;
  previousPage: string;
  nextPage: string;
  emptySlot: string;
}

interface ProfilePassportDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  stamps: ProfileStampProgress[];
  locale?: string;
  labels: ProfilePassportDialogLabels;
  resolveGroupLabel: (group: ProfileStampGroup) => string;
  onPageChange?: (page: number) => void;
  countryCode?: string | null;
  triggerRect?: DOMRect | null;
}

export const ProfilePassportDialog: React.FC<ProfilePassportDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  stamps,
  locale = 'en',
  labels,
  resolveGroupLabel,
  onPageChange,
  countryCode,
  triggerRect,
}) => {
  const theme = getPassportCoverTheme(countryCode);
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={contentRef as any}
        className="profile-passport-dialog-content !fixed !top-1/2 !left-1/2 !translate-x-0 !translate-y-0 w-[min(96vw,1120px)] max-w-6xl overflow-visible !border-none !bg-transparent !p-0 !shadow-none !rounded-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        overlayClassName="bg-black/5 backdrop-blur-[1px] transition-all duration-500"
        style={{ 
          animationDuration: '820ms' 
        } as React.CSSProperties}
      >
        <section className="profile-passport-dialog-shell px-2 pb-2 pt-4 sm:px-3 sm:pt-5">
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription>{title}</DialogDescription>
            )}
          </DialogHeader>

          <div className="profile-passport-dialog-stage">
            <div className="profile-passport-dialog-opening-book" aria-hidden="true">
              <span className="profile-passport-dialog-opening-spine" />
              <span className="profile-passport-dialog-opening-page profile-passport-dialog-opening-page--back" />
              <span className="profile-passport-dialog-opening-page profile-passport-dialog-opening-page--front" />
              <span 
                className="profile-passport-dialog-opening-cover"
                style={{ backgroundColor: theme.coverHex, borderColor: theme.borderHex }}
              />
            </div>

            <div 
              className="profile-passport-dialog-book rounded-2xl border p-2 shadow-2xl shadow-slate-900/40 sm:p-3"
              style={{ backgroundColor: theme.coverHex, borderColor: theme.borderHex }}
            >
              <div className="rounded-xl bg-white/96 backdrop-blur-[1px]">
                <ProfileStampBookViewer
                stamps={stamps}
                locale={locale}
                labels={labels}
                resolveGroupLabel={resolveGroupLabel}
                onPageChange={onPageChange}
                compact
                disableInitialOpenAnimation
              />
              </div>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};
