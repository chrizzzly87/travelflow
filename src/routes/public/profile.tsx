import React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getPublicProfilePageData } from '../../server/publicProfile';
import { buildPublicProfileHead, getPublicProfileCacheHeaders } from '../../../features/profile/publicProfileDocument';
import { PublicProfilePage } from '../../../pages/PublicProfilePage';

const FALLBACK_ORIGIN = 'https://travelflowapp.netlify.app';

export const Route = createFileRoute('/_public/u/$username')({
    loader: async ({ params }) => {
        // Handles are lowercase; a mixed-case link permanently points at the canonical URL.
        const lowercase = params.username.trim().toLowerCase();
        if (lowercase && lowercase !== params.username) {
            throw redirect({ to: '/u/$username', params: { username: lowercase }, replace: true, statusCode: 301 });
        }
        const data = await getPublicProfilePageData({ data: params.username });
        if (data.status === 'redirect') {
            throw redirect({ to: '/u/$username', params: { username: data.canonicalUsername }, replace: true });
        }
        return data;
    },
    head: ({ loaderData, match }) => {
        const document = match.context.routeDocument;
        const locale = document?.locale ?? 'en';
        return buildPublicProfileHead({
            data: loaderData,
            t: match.context.i18n.getFixedT(locale, 'profile'),
            locale,
            origin: document ? new URL(document.metadata.canonicalUrl).origin : FALLBACK_ORIGIN,
        });
    },
    headers: ({ loaderData }) => getPublicProfileCacheHeaders(loaderData),
    component: PublicProfileRoute,
});

function PublicProfileRoute() {
    const data = Route.useLoaderData();
    const { username } = Route.useParams();
    // A different profile starts with fresh paging and viewer state.
    return <PublicProfilePage key={username} username={username} data={data} />;
}
