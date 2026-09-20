import React, { useState } from 'react';
import { DeleteStrategy } from '../types';
import { ArrowLeft, ArrowRight, ArrowLeftRight, CheckSquare, Square } from 'lucide-react';
import { AppModal } from './ui/app-modal';

interface DeleteCityModalProps {
    isOpen: boolean;
    cityName: string;
    onClose: () => void;
    onConfirm: (strategy: DeleteStrategy, deleteActivities: boolean) => void;
}

export const DeleteCityModal: React.FC<DeleteCityModalProps> = ({ isOpen, cityName, onClose, onConfirm }) => {
    const [deleteActivities, setDeleteActivities] = useState(true);

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Delete ${cityName}`}
            description="How should we handle the timeline gap created by removing this city?"
            closeLabel="Close delete city dialog"
            size="sm"
            mobileSheet={false}
            bodyClassName="p-6"
            headerClassName="bg-secondary p-6"
        >
            <button
                type="button"
                className="group mb-6 flex w-full cursor-pointer select-none items-center gap-2 text-left"
                onClick={() => setDeleteActivities(!deleteActivities)}
                aria-pressed={deleteActivities}
            >
                <div className={`transition-colors ${deleteActivities ? 'text-accent-600' : 'text-gray-300 group-hover:text-muted-foreground'}`}>
                    {deleteActivities ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <span className="text-sm font-medium text-foreground">Delete attached activities</span>
            </button>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => onConfirm('extend-prev', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-border p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-400/12"
                >
                    <div className="mr-4 flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm group-hover:border-accent-200 group-hover:text-accent-600 dark:group-hover:border-accent-400/30">
                        <ArrowRight size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-foreground">Extend Previous Stay</div>
                        <div className="mt-1 text-xs text-muted-foreground">Fill the gap by staying longer in the previous city.</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onConfirm('extend-next', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-border p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-400/12"
                >
                    <div className="mr-4 flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm group-hover:border-accent-200 group-hover:text-accent-600 dark:group-hover:border-accent-400/30">
                        <ArrowLeft size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-foreground">Extend Next Stay</div>
                        <div className="mt-1 text-xs text-muted-foreground">Arrive earlier at the next city to fill the gap.</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onConfirm('move-rest', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-border p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-400/12"
                >
                    <div className="mr-4 flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm group-hover:border-accent-200 group-hover:text-accent-600 dark:group-hover:border-accent-400/30">
                        <ArrowLeftRight size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-foreground">Move Everything Up</div>
                        <div className="mt-1 text-xs text-muted-foreground">Shift all subsequent cities earlier. Shortens the trip.</div>
                    </div>
                </button>
            </div>
        </AppModal>
    );
};
