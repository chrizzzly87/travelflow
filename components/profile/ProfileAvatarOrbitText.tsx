import React from 'react';

interface ProfileAvatarOrbitTextProps {
  label: string;
}

export const ProfileAvatarOrbitText: React.FC<ProfileAvatarOrbitTextProps> = ({ label }) => {
  const orbitPathId = React.useId();

  return (
    <svg
      viewBox="0 0 120 120"
      className="profile-avatar-orbit pointer-events-none absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)]"
      aria-hidden="true"
    >
      <defs>
        <path id={orbitPathId} d="M 60,60 m -47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
      </defs>
      <text className="fill-current text-[8px] font-semibold uppercase tracking-[0.2em]">
        <textPath href={`#${orbitPathId}`} startOffset="50%" textAnchor="middle">
          {`${label} • ${label} • ${label}`}
        </textPath>
      </text>
    </svg>
  );
};
