module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/fetch-album-metadata/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/server.js [app-route] (ecmascript)");
;
async function GET(request) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'URL is required'
        }, {
            status: 400
        });
    }
    try {
        // Detect platform
        let platform = 'other';
        if (url.includes('spotify.com')) platform = 'spotify';
        else if (url.includes('music.apple.com')) platform = 'apple_music';
        else if (url.includes('music.youtube.com')) platform = 'youtube_music';
        else if (url.includes('soundcloud.com')) platform = 'soundcloud';
        else if (url.includes('tidal.com')) platform = 'tidal';
        else if (url.includes('bandcamp.com')) platform = 'bandcamp';
        console.log('[v0] Fetching metadata for:', url, 'Platform:', platform);
        // Fetch the page HTML to extract Open Graph metadata
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AlbumClub/1.0)'
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch URL');
        }
        const html = await response.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descriptionMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        console.log('[v0] Extracted image URL:', imageMatch ? imageMatch[1] : 'none');
        let title = '';
        let artist = '';
        if (titleMatch) {
            const fullTitle = titleMatch[1];
            // Platform-specific parsing
            if (platform === 'spotify') {
                // Spotify format: "Album Name - Album by Artist | Spotify"
                const parts = fullTitle.split(' - ');
                if (parts.length >= 2) {
                    title = parts[0].trim();
                    const artistPart = parts[1].replace(/Album by |, on Spotify|\| Spotify/gi, '').trim();
                    artist = artistPart.split(',')[0].trim();
                }
            } else if (platform === 'apple_music') {
                // Apple Music format: "Album Name - Album by Artist - Apple Music"
                const parts = fullTitle.split(' - ');
                if (parts.length >= 2) {
                    title = parts[0].trim();
                    artist = parts[1].replace(/Album by |on Apple Music/gi, '').trim();
                }
            } else if (platform === 'youtube_music') {
                // YouTube Music format varies, try to parse
                const parts = fullTitle.split(' - ');
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts[1].replace(/\| Album|YouTube Music/gi, '').trim();
                }
            } else {
                // Generic parsing: try to split by common separators
                if (fullTitle.includes(' - ')) {
                    const parts = fullTitle.split(' - ');
                    artist = parts[0].trim();
                    title = parts[1].trim();
                } else if (fullTitle.includes(' by ')) {
                    const parts = fullTitle.split(' by ');
                    title = parts[0].trim();
                    artist = parts[1].trim();
                } else {
                    title = fullTitle;
                }
            }
        }
        // Fallback to description if title/artist not found
        if (!artist && descriptionMatch) {
            const description = descriptionMatch[1];
            const byMatch = description.match(/by ([^,·]+)/);
            if (byMatch) {
                artist = byMatch[1].trim();
            }
        }
        const result = {
            title: title || 'Unknown Album',
            artist: artist || 'Unknown Artist',
            platform,
            albumArtwork: imageMatch ? imageMatch[1] : null
        };
        console.log('[v0] Returning metadata:', result);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
    } catch (error) {
        console.error('[v0] Error fetching album metadata:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch album metadata'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2ff68514._.js.map