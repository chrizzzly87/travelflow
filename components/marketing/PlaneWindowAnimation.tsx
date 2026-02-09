import React from 'react';

/**
 * Animated plane window with clouds scrolling behind it,
 * simulating an in-flight view.
 */
export const PlaneWindowAnimation: React.FC = () => {
    return (
        <div
            className="plane-window-wrapper relative select-none"
            /* Maintain the 580:850 aspect ratio of the window image */
            style={{ aspectRatio: '580 / 850' }}
        >
            {/* Cloud layer — clipped to sit inside the window opening */}
            <div className="plane-window-clouds-mask absolute overflow-hidden">
                <div className="flex h-full animate-clouds-scroll">
                    <img
                        src="/images/clouds.png"
                        alt=""
                        draggable={false}
                        className="h-full w-auto max-w-none shrink-0 object-cover"
                    />
                    <img
                        src="/images/clouds.png"
                        alt=""
                        draggable={false}
                        className="h-full w-auto max-w-none shrink-0 object-cover"
                    />
                </div>
            </div>

            {/* Window frame sits on top */}
            <img
                src="/images/plane-window.png"
                alt="Airplane window"
                draggable={false}
                className="relative z-10 h-full w-full object-contain drop-shadow-xl"
            />
        </div>
    );
};
