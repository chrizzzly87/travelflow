import { Check } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    Questionnaire,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireChoices,
    QuestionnaireItem,
    QuestionnaireTitle,
} from '../ui/questionnaire';

export interface TripAgentQuestionOption {
    id: string;
    label: string;
    detail?: string;
    /** What is sent as the next message when this option is chosen. */
    prompt: string;
}

/**
 * A question the agent asks mid-conversation, for example how to use days a
 * removal frees up. Choosing an option continues the conversation with that
 * option's prompt, which keeps the exchange multi-step without a second UI.
 */
export const TripAgentQuestionCard: React.FC<{
    question: string;
    options: TripAgentQuestionOption[];
    allowCustom: boolean;
    onAnswer: (prompt: string) => void;
    disabled?: boolean;
}> = ({ question, options, allowCustom, onAnswer, disabled }) => {
    const { t } = useTranslation('common');
    const [selected, setSelected] = useState<string[]>([]);
    const [custom, setCustom] = useState('');
    const [answered, setAnswered] = useState<string | null>(null);

    if (answered) {
        return (
            <p className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                <Check className="size-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 truncate">{answered}</span>
            </p>
        );
    }

    const answer = (prompt: string, label: string) => {
        if (disabled || !prompt.trim()) return;
        setAnswered(label);
        onAnswer(prompt.trim());
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label={question}>
            <Questionnaire>
                <QuestionnaireItem>
                    <QuestionnaireTitle className="text-[13px] leading-5">{question}</QuestionnaireTitle>
                    <QuestionnaireChoices
                        type="single"
                        value={selected}
                        onValueChange={(value) => {
                            setSelected(value);
                            const option = options.find((candidate) => candidate.id === value[0]);
                            if (option) answer(option.prompt, option.label);
                        }}
                        disabled={disabled}
                    >
                        {options.map((option) => (
                            <QuestionnaireChoice key={option.id} value={option.id} className="min-h-0 gap-2 p-2">
                                <span className="text-[13px] font-medium leading-5 text-slate-900">{option.label}</span>
                                {option.detail && (
                                    <QuestionnaireChoiceDescription className="mt-0 text-[11px] leading-4">
                                        {option.detail}
                                    </QuestionnaireChoiceDescription>
                                )}
                            </QuestionnaireChoice>
                        ))}
                    </QuestionnaireChoices>
                </QuestionnaireItem>
            </Questionnaire>
            {allowCustom && (
                <form
                    className="mt-2 flex items-center gap-1.5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        answer(custom, custom);
                    }}
                >
                    <Input
                        value={custom}
                        onChange={(event) => setCustom(event.currentTarget.value)}
                        placeholder={t('tripAgent.questionCustom')}
                        disabled={disabled}
                        className="h-8 text-[13px]"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={disabled || !custom.trim()}>
                        {t('tripAgent.questionSend')}
                    </Button>
                </form>
            )}
        </section>
    );
};
