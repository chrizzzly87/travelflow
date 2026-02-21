import { useState } from 'react';

export const useTripTitleEditorState = () => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState('');

    return {
        isEditingTitle,
        setIsEditingTitle,
        editTitleValue,
        setEditTitleValue,
    };
};
