import React from 'react';
import { Trash } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { AdminSelectionBar } from '../AdminSelectionBar';

/** Bulk soft and hard delete for the selected rows. Both ask for confirmation first. */
export const UsersSelectionBar: React.FC<{
    count: number;
    isSaving: boolean;
    onClear: () => void;
    onSoftDelete: () => void;
    onHardDelete: () => void;
}> = ({ count, isSaving, onClear, onSoftDelete, onHardDelete }) => (
    <AdminSelectionBar count={count} noun="user" onClear={onClear}>
        <Button type="button" variant="outline" size="sm" onClick={onSoftDelete} disabled={isSaving}>
            Soft delete
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onHardDelete} disabled={isSaving}>
            <Trash />
            Hard delete
        </Button>
    </AdminSelectionBar>
);
