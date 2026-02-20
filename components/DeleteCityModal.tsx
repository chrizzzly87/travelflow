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
            headerClassName="bg-gray-50 p-6"
        >
            <button
                type="button"
                className="group mb-6 flex w-full cursor-pointer select-none items-center gap-2 text-left"
                onClick={() => setDeleteActivities(!deleteActivities)}
                aria-pressed={deleteActivities}
            >
                <div className={`transition-colors ${deleteActivities ? 'text-accent-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
                    {deleteActivities ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <span className="text-sm font-medium text-gray-700">Delete attached activities</span>
            </button>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => onConfirm('extend-prev', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50"
                >
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm group-hover:border-accent-200 group-hover:text-accent-600">
                        <ArrowRight size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">Extend Previous Stay</div>
                        <div className="mt-1 text-xs text-gray-500">Fill the gap by staying longer in the previous city.</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onConfirm('extend-next', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50"
                >
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm group-hover:border-accent-200 group-hover:text-accent-600">
                        <ArrowLeft size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">Extend Next Stay</div>
                        <div className="mt-1 text-xs text-gray-500">Arrive earlier at the next city to fill the gap.</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onConfirm('move-rest', deleteActivities)}
                    className="group flex w-full items-center rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-accent-500 hover:bg-accent-50"
                >
                    <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm group-hover:border-accent-200 group-hover:text-accent-600">
                        <ArrowLeftRight size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">Move Everything Up</div>
                        <div className="mt-1 text-xs text-gray-500">Shift all subsequent cities earlier. Shortens the trip.</div>
                    </div>
                </button>
            </div>
        </AppModal>
    );
};
