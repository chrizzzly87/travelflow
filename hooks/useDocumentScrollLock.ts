import { useEffect, useLayoutEffect } from 'react';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface DocumentLock {
    owners: Set<symbol>;
    restore: () => void;
}

const locks = new WeakMap<Document, DocumentLock>();

const rememberStyles = (style: CSSStyleDeclaration, properties: string[]) => {
    const previous = properties.map(property => ({
        property,
        value: style.getPropertyValue(property),
        priority: style.getPropertyPriority(property),
    }));
    return () => previous.forEach(({ property, value, priority }) => {
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
    });
};

const acquireDocumentLock = (doc: Document): (() => void) => {
    const view = doc.defaultView;
    if (!view) return () => {};
    const owner = Symbol('document-scroll-lock');
    let lock = locks.get(doc);
    if (!lock) {
        const root = doc.documentElement;
        const body = doc.body;
        const scrollX = view.scrollX;
        const scrollY = view.scrollY;
        const hadScrollbarSpace = view.innerWidth > root.clientWidth;
        const bodyStyle = view.getComputedStyle(body);
        const inlineMargins = (Number.parseFloat(bodyStyle.marginLeft) || 0) + (Number.parseFloat(bodyStyle.marginRight) || 0);
        const restoreRoot = rememberStyles(root.style, ['overflow-y']);
        const restoreBody = rememberStyles(body.style, ['position', 'top', 'left', 'inline-size', 'box-sizing']);

        // WebKit removes a custom scrollbar's gutter even with scrollbar-gutter:
        // stable when overflow is hidden. Keep its existing gutter, while the
        // fixed body removes the background's actual scrollable content.
        root.style.setProperty('overflow-y', hadScrollbarSpace ? 'scroll' : 'hidden');
        body.style.setProperty('position', 'fixed');
        // Physical coordinates deliberately match window.scrollX/scrollY in RTL
        // too; layout sizing remains direction independent.
        body.style.setProperty('top', `${-scrollY}px`);
        body.style.setProperty('left', `${-scrollX}px`);
        body.style.setProperty('inline-size', inlineMargins ? `calc(100% - ${inlineMargins}px)` : '100%');
        body.style.setProperty('box-sizing', 'border-box');

        lock = {
            owners: new Set(),
            restore: () => {
                restoreBody();
                restoreRoot();
                const restoreScrollBehavior = rememberStyles(root.style, ['scroll-behavior']);
                root.style.setProperty('scroll-behavior', 'auto', 'important');
                view.scrollTo(scrollX, scrollY);
                restoreScrollBehavior();
            },
        };
        locks.set(doc, lock);
    }
    const acquiredLock = lock;
    acquiredLock.owners.add(owner);
    return () => {
        if (!acquiredLock.owners.delete(owner) || acquiredLock.owners.size) return;
        locks.delete(doc);
        acquiredLock.restore();
    };
};

/** Shared modal ownership keeps overlapping overlays from unlocking each other. */
export const useDocumentScrollLock = (active: boolean): void => {
    useBrowserLayoutEffect(() => {
        if (!active) return;
        return acquireDocumentLock(document);
    }, [active]);
};
