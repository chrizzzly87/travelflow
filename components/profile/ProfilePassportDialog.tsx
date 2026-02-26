import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
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
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1120px)] max-w-6xl overflow-visible border-none bg-transparent p-0 shadow-none">
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
              <span className="profile-passport-dialog-opening-cover" />
            </div>

            <div className="profile-passport-dialog-book rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur-[1px] sm:p-4">
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
        </section>
      </DialogContent>
    </Dialog>
  );
};
