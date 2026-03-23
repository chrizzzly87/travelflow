import React from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';

import { Badge } from '../../ui/badge';
import { NumberInput } from '../../ui/number-input';

const DEMO_EUR_RATES: Record<string, number> = {
    TH: 39.1,
    KH: 4420,
    VN: 27150,
    LA: 23650,
};

const formatAmount = (value: number, maximumFractionDigits = 0): string => new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
}).format(value);

const roundToCurrencyStep = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
};

interface TripWorkspaceCurrencyConverterProps {
    countryCode?: string | null;
    currencyCode: string;
    currencyName: string;
    title?: string;
    description?: string;
    defaultEurAmount?: number;
}

export const TripWorkspaceCurrencyConverter: React.FC<TripWorkspaceCurrencyConverterProps> = ({
    countryCode,
    currencyCode,
    currencyName,
    title = 'Currency converter',
    description = 'Use a live input to sanity-check what arrival cash or a city day actually feels like.',
    defaultEurAmount = 100,
}) => {
    const rate = DEMO_EUR_RATES[countryCode ?? ''] ?? 1;
    const [eurAmount, setEurAmount] = React.useState<number>(defaultEurAmount);
    const [localAmount, setLocalAmount] = React.useState<number>(roundToCurrencyStep(defaultEurAmount * rate));

    React.useEffect(() => {
        setLocalAmount(roundToCurrencyStep(eurAmount * rate));
    }, [eurAmount, rate]);

    const handleEurChange = React.useCallback((value: string) => {
        const nextValue = Number(value);
        if (!Number.isFinite(nextValue)) {
            setEurAmount(0);
            setLocalAmount(0);
            return;
        }

        setEurAmount(nextValue);
        setLocalAmount(roundToCurrencyStep(nextValue * rate));
    }, [rate]);

    const handleLocalChange = React.useCallback((value: string) => {
        const nextValue = Number(value);
        if (!Number.isFinite(nextValue)) {
            setEurAmount(0);
            setLocalAmount(0);
            return;
        }

        setLocalAmount(nextValue);
        setEurAmount(roundToCurrencyStep(nextValue / rate));
    }, [rate]);

    return (
        <div className="rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
                <Badge variant="outline">Demo rate</Badge>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <label htmlFor="trip-workspace-converter-eur" className="text-sm font-medium text-foreground">EUR</label>
                        <span className="text-xs text-muted-foreground">Base</span>
                    </div>
                    <NumberInput
                        id="trip-workspace-converter-eur"
                        min={0}
                        step="1"
                        value={eurAmount}
                        onChange={(event) => handleEurChange(event.currentTarget.value)}
                        format={{ maximumFractionDigits: 0 }}
                    />
                </div>
                <div className="flex items-center justify-center lg:pb-2">
                    <div className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground">
                        <ArrowsLeftRight size={16} weight="duotone" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <label htmlFor="trip-workspace-converter-local" className="text-sm font-medium text-foreground">{currencyCode}</label>
                        <span className="text-xs text-muted-foreground">{currencyName}</span>
                    </div>
                    <NumberInput
                        id="trip-workspace-converter-local"
                        min={0}
                        step="1"
                        value={localAmount}
                        onChange={(event) => handleLocalChange(event.currentTarget.value)}
                        format={{ maximumFractionDigits: 0 }}
                    />
                </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                1 EUR is currently modeled as roughly <span className="font-medium text-foreground">{formatAmount(rate, 2)} {currencyCode}</span> for this demo route.
            </p>
        </div>
    );
};
