import React, { useEffect, useRef, useState } from 'react';
import { DeleteStrategy } from '../types';
import { ArrowLeft, ArrowRight, X, ArrowLeftRight, CheckSquare, Square } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DeleteCityModalProps {
    isOpen: boolean;
    cityName: string;
    onClose: () => void;
    onConfirm: (strategy: DeleteStrategy, deleteActivities: boolean) => void;
}

export const DeleteCityModal: React.FC<DeleteCityModalProps> = ({ isOpen, cityName, onClose, onConfirm }) => {
    const [deleteActivities, setDeleteActivities] = useState(true);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useFocusTrap({
        isActive: isOpen,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close delete city dialog"
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-city-title"
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 id="delete-city-title" className="text-lg font-bold text-gray-800">Delete {cityName}</h3>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-500" aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm">
                        How should we handle the timeline gap created by removing this city?
                    </p>

                    <button
                        type="button"
                        className="w-full flex items-center gap-2 mb-6 cursor-pointer select-none group text-left"
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
                            className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-accent-500 hover:bg-accent-50 transition-all group text-left"
                        >
                            <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 group-hover:text-accent-600 group-hover:border-accent-200 mr-4 shadow-sm">
                                <ArrowRight size={20} />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-800">Extend Previous Stay</div>
                                <div className="text-xs text-gray-500 mt-1">Fill the gap by staying longer in the previous city.</div>
                            </div>
                        </button>

                        <button 
                            type="button"
                            onClick={() => onConfirm('extend-next', deleteActivities)}
                            className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-accent-500 hover:bg-accent-50 transition-all group text-left"
                        >
                            <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 group-hover:text-accent-600 group-hover:border-accent-200 mr-4 shadow-sm">
                                <ArrowLeft size={20} />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-800">Extend Next Stay</div>
                                <div className="text-xs text-gray-500 mt-1">Arrive earlier at the next city to fill the gap.</div>
                            </div>
                        </button>

                        <button 
                            type="button"
                            onClick={() => onConfirm('move-rest', deleteActivities)}
                            className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-accent-500 hover:bg-accent-50 transition-all group text-left"
                        >
                            <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 group-hover:text-accent-600 group-hover:border-accent-200 mr-4 shadow-sm">
                                <ArrowLeftRight size={20} />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-800">Move Everything Up</div>
                                <div className="text-xs text-gray-500 mt-1">Shift all subsequent cities earlier. Shortens the trip.</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
