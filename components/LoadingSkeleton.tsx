import React, { useState, useEffect } from 'react';
import { Loader2, Map, Plane } from 'lucide-react';

export const LoadingSkeleton: React.FC = () => {
    const [message, setMessage] = useState("Initializing AI Agent...");
    
    useEffect(() => {
        const messages = [
            "Analyzing your travel preferences...",
            "Scouting top-rated cities & stops...",
            "Calculating optimal travel routes...",
            "Finding hidden gems & local favorites...",
            "Structuring your daily timeline...",
            "Finalizing logistics & details...",
            "Polishing your itinerary..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setMessage(messages[i % messages.length]);
            i++;
        }, 2200); // Change message every 2.2s to feel dynamic
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden animate-in fade-in duration-500">
            {/* Header Skeleton */}
            <div className="h-16 border-b border-gray-100 flex items-center px-6 justify-between shrink-0 bg-white z-10">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="w-32 h-6 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse" />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Simulated Vertical Layout (Map Top, Timeline Bottom) */}
                <div className="flex flex-col w-full h-full">
                    
                    {/* Map Skeleton */}
                    <div className="h-1/3 bg-gray-50 border-b border-gray-100 relative overflow-hidden">
                        <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-4 p-4 opacity-50">
                             {[...Array(24)].map((_, i) => (
                                 <div key={i} className="bg-gray-200/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms`}} />
                             ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Map className="text-gray-300 w-16 h-16 animate-bounce opacity-50" />
                        </div>
                    </div>

                    {/* Timeline Skeleton */}
                    <div className="flex-1 bg-white p-8 relative overflow-hidden">
                        {/* Dates Sidebar */}
                        <div className="absolute left-0 top-0 bottom-0 w-20 border-r border-gray-50 flex flex-col items-center pt-8 gap-12 bg-white z-10">
                             {[...Array(6)].map((_, i) => (
                                 <div key={i} className="flex flex-col items-center gap-2 w-full">
                                     <div className="w-10 h-3 bg-gray-100 rounded animate-pulse" />
                                     <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                                 </div>
                             ))}
                        </div>

                        {/* Timeline Items */}
                        <div className="ml-24 space-y-12 mt-4">
                             {[...Array(3)].map((_, i) => (
                                 <div key={i} className="flex flex-col gap-6 relative">
                                     {/* Connection Line */}
                                     {i < 2 && <div className="absolute left-6 top-16 bottom-[-30px] w-0.5 bg-gray-100 border-l border-dashed border-gray-300" />}
                                     
                                     {/* City Block */}
                                     <div className="w-4/5 h-24 bg-gray-50 rounded-xl animate-pulse border border-gray-100 flex items-center p-4 gap-4 shadow-sm">
                                         <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                                         <div className="space-y-3 flex-1">
                                             <div className="w-1/3 h-4 bg-gray-200 rounded" />
                                             <div className="w-2/3 h-3 bg-gray-200 rounded" />
                                         </div>
                                     </div>
                                     
                                     {/* Travel Block */}
                                     {i < 2 && (
                                        <div className="w-full flex items-center gap-4 px-8 opacity-60">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                <Plane className="text-gray-300 w-4 h-4" />
                                            </div>
                                            <div className="h-0.5 flex-1 bg-gray-100" />
                                        </div>
                                     )}
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>

                {/* Central Status Overlay */}
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full text-center flex flex-col items-center gap-5 animate-in zoom-in-95 duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-accent-100 rounded-full animate-ping opacity-30" />
                            <div className="bg-accent-50 p-4 rounded-full text-accent-600 relative z-10">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Planning Trip...</h3>
                            <p className="text-sm text-gray-500 font-medium h-5 transition-all duration-300 ease-in-out">{message}</p>
                        </div>
                        
                        {/* Progress Bar (Fake but effective) */}
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-gradient-to-r from-accent-500 to-accent-600 animate-[loading_15s_ease-out_forwards] w-full origin-left scale-x-0" />
                        </div>
                        <style>{`
                            @keyframes loading {
                                0% { transform: scaleX(0.05); }
                                20% { transform: scaleX(0.2); }
                                40% { transform: scaleX(0.4); }
                                60% { transform: scaleX(0.65); }
                                80% { transform: scaleX(0.85); }
                                95% { transform: scaleX(0.98); }
                                100% { transform: scaleX(0.99); }
                            }
                        `}</style>
                        
                        <p className="text-xs text-gray-400 mt-2">Powered by Gemini AI</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
