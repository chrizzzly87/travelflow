import React, { useEffect } from 'react';
import Prism from 'prismjs';
if (typeof window !== 'undefined') {
    const prismWindow = window as typeof window & { Prism?: typeof Prism };
    prismWindow.Prism = prismWindow.Prism || Prism;
}
import 'prismjs/components/prism-json';

export { Prism };

type PrismNode = string | Prism.Token | Array<string | Prism.Token>;

/**
 * Renders Prism tokens as elements, matching `Prism.highlight` markup
 * (`<span class="token type alias">`) without injecting an HTML string.
 * Prism turns non-breaking spaces into plain spaces; so does this.
 */
export const renderPrismTokens = (node: PrismNode, key: React.Key = 0): React.ReactNode => {
    if (typeof node === 'string') return node.replace(/\u00a0/g, ' ');
    if (Array.isArray(node)) return node.map((child, index) => renderPrismTokens(child, index));
    const aliases = node.alias ? (Array.isArray(node.alias) ? node.alias : [node.alias]) : [];
    return React.createElement(
        'span',
        { key, className: ['token', node.type, ...aliases].join(' ') },
        renderPrismTokens(node.content as PrismNode),
    );
};

export const tokenizeJson = (value: string) => Prism.tokenize(value, Prism.languages.json);

/** Loads the dark Prism theme the benchmark's JSON blocks use (the run sheet's too). */
export const usePrismThemeStylesheet = () => {
    useEffect(() => {
        void import('prismjs/themes/prism-tomorrow.css');
    }, []);
};
