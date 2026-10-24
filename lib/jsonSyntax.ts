import Prism from 'prismjs';

// Keep the grammar module-local: Prism's side-effect language plugins require a
// global Prism before ESM dependencies execute, which fails on cold route chunks.
// JSON highlighting needs no global registration or automatic DOM highlighting.
export const jsonGrammar: Prism.Grammar = {
    property: { pattern: /"(?:\\.|[^"\\\r\n])*"(?=\s*:)/, greedy: true },
    string: { pattern: /"(?:\\.|[^"\\\r\n])*"/, greedy: true },
    number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
    boolean: /\b(?:true|false)\b/,
    null: { pattern: /\bnull\b/, alias: 'keyword' },
    punctuation: /[{}[\],]/,
    operator: /:/,
};

export { Prism };
