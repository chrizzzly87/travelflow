import React from 'react';
import type { OAuthProviderId } from '../../services/authService';

interface SocialProviderIconProps {
    provider: OAuthProviderId;
    size?: number;
    className?: string;
}

const GoogleBrandIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
    >
        <path d="M23.52 12.27c0-.79-.07-1.55-.22-2.27H12v4.3h6.47a5.5 5.5 0 0 1-2.4 3.61v3h3.88c2.27-2.08 3.57-5.14 3.57-8.64z" fill="#4285F4" />
        <path d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.73-2.46 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24z" fill="#34A853" />
        <path d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.28a12 12 0 0 0 0 10.78l3.99-3.09z" fill="#FBBC05" />
        <path d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.43-3.43C17.95 1.2 15.24 0 12 0A12 12 0 0 0 1.28 6.61L5.27 9.7c.95-2.85 3.6-4.93 6.73-4.93z" fill="#EA4335" />
    </svg>
);

const AppleBrandIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 384 512"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
    >
        <path d="M318.7 268.5c-.2-36.7 16.4-64.4 49.8-84.4-18.6-26.6-46.7-41.2-84-43.9-35.3-2.8-73.7 20.8-87.8 20.8-14.9 0-48.8-19.8-75.7-19.8C65.8 142.2 0 185.1 0 270.5c0 25.2 4.6 51.3 13.9 78.3 12.4 35.6 57.2 122.8 103.9 121.4 24.4-.6 41.7-17.4 73.5-17.4 30.8 0 46.9 17.4 74.1 17.4 47.1-.7 87.8-79.9 99.6-115.6-67-31.5-64.1-92.5-64.3-85.1zm-56.7-164c27.1-32.1 24.6-61.4 23.8-71.9-24 1.4-51.8 16.3-67.6 34.7-17.4 19.9-27.6 44.5-25.4 71.9 25.9 2 49.7-11.2 69.2-34.7z" />
    </svg>
);

const FacebookBrandIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
    >
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path d="M13.5 8H15V5.5H13.2c-2.48 0-3.93 1.55-3.93 4.12v1.58H7v2.5h2.27V19h2.8v-5.3h2.33l.36-2.5h-2.69V9.9c0-.8.31-1.9 1.43-1.9z" fill="#fff" />
    </svg>
);

export const SocialProviderIcon: React.FC<SocialProviderIconProps> = ({
    provider,
    size = 18,
    className,
}) => {
    if (provider === 'google') return <GoogleBrandIcon size={size} className={className} />;
    if (provider === 'facebook') return <FacebookBrandIcon size={size} className={className} />;
    return <AppleBrandIcon size={size} className={className} />;
};

