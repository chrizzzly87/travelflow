import React from 'react';
import { X } from 'lucide-react';
import { FlagIcon } from './flags/FlagIcon';

interface CountryTagProps {
    countryName: string;
    flag?: string;
    metaLabel?: string;
    onRemove?: () => void;
    removable?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

export const CountryTag: React.FC<CountryTagProps> = ({
    countryName,
    flag = '🌍',
    metaLabel,
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
            <FlagIcon value={flag} size={isSmall ? 'sm' : 'md'} />
            <span className={metaLabel && !isSmall ? 'flex flex-col leading-tight' : ''}>
                <span>{countryName}</span>
                {metaLabel && !isSmall && <span className="text-[10px] font-medium text-gray-500">{metaLabel}</span>}
            </span>
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
                    title={`Remove ${countryName}`}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
};
