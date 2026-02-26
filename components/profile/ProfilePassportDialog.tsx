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
      <DialogContent className="w-[min(96vw,1120px)] max-w-6xl overflow-hidden border-slate-200 p-0">
        <section className="profile-passport-dialog-shell max-h-[88vh] overflow-y-auto bg-slate-50 p-4 sm:p-5">
          <DialogHeader className="space-y-1 pb-3 text-left">
            <DialogTitle className="text-xl font-black tracking-tight text-slate-900">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm text-slate-600">{description}</DialogDescription>
            ) : null}
            {!description ? (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="profile-passport-dialog-book rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <ProfileStampBookViewer
              stamps={stamps}
              locale={locale}
              labels={labels}
              resolveGroupLabel={resolveGroupLabel}
              onPageChange={onPageChange}
            />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};
