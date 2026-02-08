import React from 'react';
import { X } from 'lucide-react';

interface CountryTagProps {
    countryName: string;
    flag?: string;
    onRemove?: () => void;
    removable?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

export const CountryTag: React.FC<CountryTagProps> = ({
    countryName,
    flag = '🌍',
    onRemove,
    removable = false,
    size = 'md',
    className = '',
}) => {
    const isSmall = size === 'sm';

    return (
        <span
            className={[
                'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm',
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium',
                className,
            ].join(' ').trim()}
        >
            <span>{flag}</span>
            <span>{countryName}</span>
            {removable && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove?.();
                    }}
                    className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${countryName}`}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
};
