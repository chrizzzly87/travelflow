import React from 'react';
import { ITrip } from '../types';
import { X, Calendar, ArrowRight, Trash2, Clock } from 'lucide-react';
import { getAllTrips, deleteTrip } from '../services/storageService';

interface TripManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: ITrip) => void;
  currentTripId?: string;
}

export const TripManager: React.FC<TripManagerProps> = ({ isOpen, onClose, onSelectTrip, currentTripId }) => {
  const [trips, setTrips] = React.useState<ITrip[]>([]);

  const loadTrips = () => {
    setTrips(getAllTrips());
  };

  React.useEffect(() => {
    // Load trips whenever the modal opens
    if (isOpen) {
      loadTrips();
    }
  }, [isOpen]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this trip?")) {
        deleteTrip(id);
        loadTrips();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[1100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer - Z-index must be higher than map (400) and leafet controls (1000) */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[1200] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">My Plans</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {trips.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <p>No saved plans yet.</p>
                </div>
            ) : (
                trips.map(trip => (
                    <div 
                        key={trip.id}
                        onClick={() => { onSelectTrip(trip); onClose(); }}
                        className={`group p-4 rounded-xl border transition-all cursor-pointer relative hover:shadow-md
                            ${trip.id === currentTripId ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200'}
                        `}
                    >
                        <h3 className={`font-bold mb-1 text-sm ${trip.id === currentTripId ? 'text-indigo-700' : 'text-gray-800'}`}>
                            {trip.title}
                        </h3>
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                            <Calendar size={12} className="mr-1" />
                            <span>{new Date(trip.startDate).toLocaleDateString()}</span>
                            <span className="mx-2">•</span>
                            <span>{trip.items.filter(i => i.type === 'city').length} stops</span>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-400">
                            <Clock size={10} className="mr-1" />
                            Updated {new Date(trip.updatedAt).toLocaleDateString()}
                        </div>

                        <button 
                            onClick={(e) => handleDelete(e, trip.id)}
                            className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>
    </>
  );
};