import React from 'react';

const fields = ['reason', 'subReason', 'name', 'email', 'message', 'currentPath', 'lastVisitedPath', 'locale', 'contactSource', 'userId', 'plan', 'appVersion', 'bot-field'];

/** Netlify discovers the form schema from prerendered HTML during deployment. */
export function ContactFormRegistration() {
    return <form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" hidden aria-hidden="true">
        <input type="hidden" name="form-name" value="contact" />
        {fields.map(name => <input key={name} type="hidden" name={name} />)}
    </form>;
}
