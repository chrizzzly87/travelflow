import React from 'react';
import {
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSun,
    Drop,
    SunDim,
    ThermometerSimple,
} from '@phosphor-icons/react';

import type { TripWorkspaceWeatherForecastDay, TripWorkspaceWeatherSignal } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';

const parseTemperature = (value: string): number => {
    const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parsePercent = (value: string): number => {
    const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

const resolveWeatherVisual = (condition: string) => {
    const normalized = condition.toLowerCase();
    if (normalized.includes('storm')) {
        return {
            icon: CloudLightning,
            className: 'text-violet-600',
            label: 'Storm edge',
        };
    }
    if (normalized.includes('rain') || normalized.includes('burst')) {
        return {
            icon: CloudRain,
            className: 'text-sky-600',
            label: 'Rain risk',
        };
    }
    if (normalized.includes('mist') || normalized.includes('fog')) {
        return {
            icon: CloudFog,
            className: 'text-slate-500',
            label: 'Low contrast',
        };
    }
    if (normalized.includes('cloud')) {
        return {
            icon: CloudSun,
            className: 'text-cyan-700',
            label: 'Mixed sky',
        };
    }
    return {
        icon: SunDim,
        className: 'text-amber-500',
        label: 'Brighter window',
    };
};

export const TripWorkspaceWeatherHeroWidget: React.FC<{
    cityTitle: string;
    headline: string;
    forecast: TripWorkspaceWeatherForecastDay[];
    signals: TripWorkspaceWeatherSignal[];
}> = ({ cityTitle, headline, forecast, signals }) => {
    const today = forecast[0];
    const visual = resolveWeatherVisual(today?.condition ?? headline);
    const WeatherIcon = visual.icon;

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
                <p className="text-sm font-medium text-muted-foreground">Active city</p>
                <h4 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{cityTitle}</h4>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{headline}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                    {signals.map((signal) => (
                        <Badge key={signal.label} variant={signal.tone}>{signal.label}: {signal.value}</Badge>
                    ))}
                </div>
            </div>
            <div className="flex min-w-[13rem] items-end justify-between gap-4 rounded-[1.75rem] border border-border/70 bg-muted/20 px-5 py-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{today?.label ?? 'Today'}</p>
                    <p className="mt-2 flex items-end gap-2 text-4xl font-semibold tracking-tight text-foreground">
                        {today?.tempC ?? '—'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{today?.condition ?? visual.label}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <WeatherIcon size={44} weight="duotone" className={visual.className} />
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Drop size={14} weight="duotone" className="text-sky-600" />
                        {today?.rainChance ?? '0%'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const TripWorkspaceWeatherForecastStrip: React.FC<{
    forecast: TripWorkspaceWeatherForecastDay[];
}> = ({ forecast }) => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {forecast.map((day) => {
            const visual = resolveWeatherVisual(day.condition);
            const WeatherIcon = visual.icon;

            return (
                <div key={day.label} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-foreground">{day.label}</p>
                            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                                <ThermometerSimple size={18} weight="duotone" className="text-rose-500" />
                                {day.tempC}
                            </p>
                        </div>
                        <WeatherIcon size={30} weight="duotone" className={visual.className} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{day.condition}</p>
                    <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                        <Drop size={14} weight="duotone" className="text-sky-600" />
                        {day.rainChance}
                    </div>
                </div>
            );
        })}
    </div>
);

export const TripWorkspaceWeatherTrendChart: React.FC<{
    forecast: TripWorkspaceWeatherForecastDay[];
}> = ({ forecast }) => {
    const width = 420;
    const height = 180;
    const points = forecast.map((day, index) => ({
        label: day.label,
        temperature: parseTemperature(day.tempC),
        rain: parsePercent(day.rainChance),
        x: 36 + (index * ((width - 72) / Math.max(forecast.length - 1, 1))),
    }));
    const temperatures = points.map((point) => point.temperature);
    const minTemperature = Math.min(...temperatures, 0);
    const maxTemperature = Math.max(...temperatures, 1);
    const tempRange = Math.max(maxTemperature - minTemperature, 1);
    const toY = (temperature: number) => 32 + ((maxTemperature - temperature) / tempRange) * 88;
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${toY(point.temperature)}`).join(' ');

    return (
        <div className="rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">4-day trend</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">A simple temperature line with rain pressure underneath.</p>
                </div>
                <Badge variant="outline">Demo forecast</Badge>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-44 w-full">
                <line x1="24" y1="122" x2={width - 24} y2="122" stroke="currentColor" className="text-border" />
                <line x1="24" y1="32" x2="24" y2="122" stroke="currentColor" className="text-border" />
                {points.map((point) => {
                    const barHeight = (point.rain / 100) * 44;
                    return (
                        <g key={point.label}>
                            <rect
                                x={point.x - 14}
                                y={134 - barHeight}
                                width="28"
                                height={barHeight}
                                rx="10"
                                className="fill-sky-100"
                            />
                            <text x={point.x} y="154" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                                {point.label}
                            </text>
                        </g>
                    );
                })}
                <path d={linePath} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point) => (
                    <g key={`${point.label}-dot`}>
                        <circle cx={point.x} cy={toY(point.temperature)} r="6" fill="white" stroke="#0f766e" strokeWidth="3" />
                        <text x={point.x} y={toY(point.temperature) - 12} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                            {point.temperature}°
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
