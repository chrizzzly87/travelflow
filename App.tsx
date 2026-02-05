import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
import { CreateTripForm } from './components/CreateTripForm';
import { TripView } from './components/TripView';
import { ITrip, IViewSettings } from './types';
import { TripManager } from './components/TripManager';
import { SettingsModal } from './components/SettingsModal';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry } from './services/historyService';
import { compressTrip, decompressTrip } from './utils';

// Wrapper to handle navigation after trip generation
const HomeRequestRedirect = ({ trip }: { trip: ITrip | null }) => {
    // Determine if we should redirect to ID or Encoded URL based on implementation preference.
    // User requested "works without database", so we prefer Encoded URL default for new trips?
    // Or we keep using ID for local persistence and only use Encoded for "Share" feature?
    // User said "i dont see the url anymore... i want to be able to share the url".
    // This implies the MAIN url should be the shared one, OR we provide a "Share" button.
    // However, "refresh the page" requirement implies the current URL must hold the state.
    // So we should redirect to Encoded URL by default.
    return trip ? <Navigate to={`/trip/${compressTrip(trip)}`} replace /> : null;
};

// Component to handle trip loading from URL
const TripLoader = ({ 
    trip, 
    onTripLoaded, 
    handleUpdateTrip, 
    handleCommitState,
    setIsManagerOpen, 
    setIsSettingsOpen 
}: { 
    trip: ITrip | null, 
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    handleUpdateTrip: (t: ITrip, options?: { persist?: boolean }) => void,
    handleCommitState: (t: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void
}) => {
    const { tripData } = useParams(); // changed from tripId to tripData to reflect dual nature
    const navigate = useNavigate();
    const lastTripDataRef = useRef<string | null>(null);
    
    // Store view settings to pass to TripView
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);

    useEffect(() => {
        if (!tripData) return;
        if (lastTripDataRef.current === tripData) return;
        lastTripDataRef.current = tripData;

        // 1. Try Decompression (Stateless sharing)
        const sharedState = decompressTrip(tripData);
        if (sharedState) {
            const { trip: loadedTrip, view } = sharedState;
            const localTrip = getTripById(loadedTrip.id);
            const mergedTrip: ITrip = {
                ...loadedTrip,
                isFavorite: localTrip?.isFavorite ?? loadedTrip.isFavorite ?? false,
            };

            setViewSettings(view);
            onTripLoaded(mergedTrip, view);
            return;
        }

        // 2. Fallback: Try ID Lookup (Legacy/Local persistence)
        const loaded = getTripById(tripData);
        if (loaded) {
            onTripLoaded(loaded);
            // Replace URL with encoded version
            navigate(`/trip/${compressTrip(loaded)}`, { replace: true });
        } else {
            console.error("Failed to load trip from URL");
            navigate('/', { replace: true });
        }
    }, [tripData, navigate, onTripLoaded]);

    if (!trip) return null; // Or loading spinner

    return (
        <TripView 
            trip={trip} 
            initialViewSettings={viewSettings}
            onUpdateTrip={(updatedTrip, options) => {
                handleUpdateTrip(updatedTrip, options);
            }}
            onCommitState={(updatedTrip, settings, options) => {
                handleCommitState(updatedTrip, settings, options);
            }}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
            }}
            onOpenManager={() => setIsManagerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
        />
    );
};

const AppContent: React.FC = () => {
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const navigate = useNavigate();

    // Persist trip changes
    const handleUpdateTrip = (updatedTrip: ITrip, options?: { persist?: boolean }) => {
        setTrip(updatedTrip);
        if (options?.persist === false) return;
        saveTrip(updatedTrip);
    };

    const handleCommitState = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => {
        const url = `/trip/${compressTrip(updatedTrip, view)}`;
        navigate(url, { replace: options?.replace ?? false });
        appendHistoryEntry(updatedTrip.id, url, options?.label || 'Updated trip');
    };

    const handleTripGenerated = (newTrip: ITrip) => {
        setTrip(newTrip);
        saveTrip(newTrip);
        // Navigate to Compressed URL
        const compressed = compressTrip(newTrip);
        navigate(`/trip/${compressed}`);
    };

    const handleLoadTrip = (loadedTrip: ITrip) => {
        setTrip(loadedTrip);
        setIsManagerOpen(false);
        // Navigate to Compressed URL
        const compressed = compressTrip(loadedTrip);
        navigate(`/trip/${compressed}`);
    };

    const handleCreateNew = () => {
        setTrip(null);
        navigate('/');
    };

    return (
        <>
            <Routes>
                <Route 
                    path="/" 
                    element={
                        <CreateTripForm 
                            onTripGenerated={handleTripGenerated} 
                            onOpenManager={() => setIsManagerOpen(true)}
                        />
                    } 
                />
                <Route 
                    path="/trip/:tripData" 
                    element={
                        <TripLoader 
                            trip={trip}
                            onTripLoaded={setTrip}
                            handleUpdateTrip={handleUpdateTrip}
                            handleCommitState={handleCommitState}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                        />
                    } 
                />
                 {/* Legacy Redirect */}
                 <Route path="/trip" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Global Modals */}
            <TripManager 
                isOpen={isManagerOpen} 
                onClose={() => setIsManagerOpen(false)} 
                onSelectTrip={handleLoadTrip}
                currentTripId={trip?.id}
                onUpdateTrip={(updatedTrip) => {
                    if (!trip || trip.id !== updatedTrip.id) return;
                    handleUpdateTrip(updatedTrip, { persist: false });
                }}
            />
            
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AppContent />
        </Router>
    );
};

export default App;
