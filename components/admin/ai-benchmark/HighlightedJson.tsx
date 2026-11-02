import React, { useMemo } from 'react';
import { renderPrismTokens, tokenizeJson } from './prismJson';

/** JSON with Prism's token classes, for the dark theme the page loads. */
export const HighlightedJson: React.FC<{ value: string }> = ({ value }) => {
    const tokens = useMemo(() => tokenizeJson(value), [value]);
    return <code className="language-json">{renderPrismTokens(tokens)}</code>;
};
