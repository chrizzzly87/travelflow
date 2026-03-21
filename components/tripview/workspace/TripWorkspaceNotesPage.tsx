import React from 'react';
import { PushPinSimple } from '@phosphor-icons/react';

import { THAILAND_NOTES } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

export const TripWorkspaceNotesPage: React.FC = () => {
    const [pinnedId, setPinnedId] = React.useState<string>(THAILAND_NOTES[0]?.id ?? '');

    return (
        <div className="grid gap-4 xl:grid-cols-3">
            {THAILAND_NOTES.map((note) => {
                const isPinned = pinnedId === note.id;
                return (
                    <Card key={note.id} className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline">{note.type}</Badge>
                                <button
                                    type="button"
                                    onClick={() => setPinnedId(note.id)}
                                    className={`rounded-full border p-2 transition-colors ${
                                        isPinned
                                            ? 'border-accent-500 bg-accent-50 text-accent-700'
                                            : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                    }`}
                                    aria-label={isPinned ? 'Pinned note' : 'Pin note'}
                                >
                                    <PushPinSimple size={14} weight={isPinned ? 'fill' : 'duotone'} />
                                </button>
                            </div>
                            <CardDescription>{isPinned ? 'Pinned note' : 'Diary stub'}</CardDescription>
                            <CardTitle>{note.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-6 text-muted-foreground">{note.body}</p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
