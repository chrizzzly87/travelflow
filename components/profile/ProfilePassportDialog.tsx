import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { ProfileStampProgress } from './profileStamps';
import { ProfilePassportBook } from './ProfilePassportBook';
import { ProfileStampCard } from './ProfileStampCard';

interface ProfilePassportDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  openLabel: string;
  emptyLabel: string;
  unlockedOnLabel: string;
  stamps: ProfileStampProgress[];
  previewStamps: ProfileStampProgress[];
  countryCode?: string | null;
  locale?: string;
}

export const ProfilePassportDialog: React.FC<ProfilePassportDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  openLabel,
  emptyLabel,
  unlockedOnLabel,
  stamps,
  previewStamps,
  countryCode,
  locale = 'en',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1120px)] max-w-6xl overflow-hidden p-0">
        <section className="profile-passport-modal-shell grid max-h-[88vh] gap-0 overflow-y-auto md:grid-cols-[minmax(320px,0.88fr)_minmax(0,1.12fr)]">
          <div className="profile-passport-modal-cover border-e border-slate-200 bg-slate-50 p-4 sm:p-5">
            <ProfilePassportBook
              title={title}
              description={description}
              openLabel={openLabel}
              stamps={previewStamps}
              countryCode={countryCode}
              testId="profile-passport-dialog-book"
            />
          </div>

          <div className="profile-passport-modal-grid p-4 sm:p-5">
            <DialogHeader className="space-y-1 border-b border-slate-200 pb-3 text-left">
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">{title}</DialogTitle>
              {description ? (
                <p className="text-sm text-slate-600">{description}</p>
              ) : null}
            </DialogHeader>

            {stamps.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">{emptyLabel}</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {stamps.map((stamp) => (
                  <ProfileStampCard
                    key={`passport-dialog-stamp-${stamp.definition.id}`}
                    stamp={stamp}
                    locale={locale}
                    unlockedOnLabel={unlockedOnLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};
