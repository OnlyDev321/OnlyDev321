const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USER || 'OnlyDev321';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const headers = {
            'User-Agent': 'Cyberpunk-Card-Generator',
            'Accept': 'application/vnd.github.v3+json'
        };
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }
        https.get(urlObj, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                } else {
                    reject(new Error(`Request failed (${res.statusCode}): ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function getUserLanguages(username) {
    console.log(`Fetching repositories for ${username}...`);
    const repos = await fetchJson(`https://api.github.com/users/${username}/repos?per_page=100&type=owner`);
    if (!Array.isArray(repos)) {
        throw new Error('Repos response is not an array: ' + JSON.stringify(repos));
    }

    const languageMap = {};
    for (const repo of repos) {
        if (repo.fork) continue;
        if (!repo.languages_url) continue;
        try {
            const langs = await fetchJson(repo.languages_url);
            for (const [name, bytes] of Object.entries(langs)) {
                languageMap[name] = (languageMap[name] || 0) + bytes;
            }
        } catch (err) {
            console.warn(`Could not fetch languages for ${repo.name}:`, err.message);
        }
    }

    const languages = Object.entries(languageMap).map(([name, count]) => ({
        name,
        count
    }));

    languages.sort((a, b) => b.count - a.count);
    return languages;
}

function generateLanguagesCard(languages, options = {}) {
    const theme = {
        titleColor: '#00c8ff',
        textColor: '#ffffff',
        iconColor: '#00c8ff',
        bgColor: '#0a0e27',
        borderColor: '#888888',
        fontName: 'Orbitron',
        fontFamily: `'Orbitron', 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    };

    const dataBorderStyle = options.dataBorderStyle || 'solid';
    const dataBorderFramePosition = options.dataBorderFramePosition || 'out';
    const showDataBorderStroke = dataBorderStyle === 'solid';
    const showDataBorderFrame = dataBorderStyle === 'frame';

    const width = 1200;
    const height = 600;

    const scale = width / 1200;
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = 24;

    const sortedLanguages = [...languages]
        .filter(lang => lang.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    const totalCount = sortedLanguages.reduce((sum, lang) => sum + lang.count, 0) || 1;
    const maxCount = Math.max(...sortedLanguages.map(lang => lang.count), 1);
    const listLength = options.listLength ?? 5;
    const topLanguagesCount = Math.min(Math.max(listLength, 0), sortedLanguages.length);

    const hashString = (value) => {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const spacingJitter = (seed, min, max) => {
        const x = Math.sin(seed) * 10000;
        const rand = x - Math.floor(x);
        return min + rand * (max - min);
    };

    const s = (n) => n * scale;
    const si = (n) => Math.round(n * scale);

    const bubbles = sortedLanguages.map((lang, index) => {
        const hash = hashString(lang.name);
        const baseAngle = (index / Math.max(sortedLanguages.length, 1)) * Math.PI * 2;
        const angleOffset = ((hash % 30) - 15) * (Math.PI / 180);
        const angle = baseAngle + angleOffset;
        const ringRadius = s(180 + (hash % 80));
        const share = (lang.count / totalCount) * 100;
        const percent = Math.round(share);
        const radius = s(38 + (lang.count / maxCount) * 92);
        const hue = hash % 360;
        const accent = `hsl(${hue}, 70%, 60%)`;
        const accentSoft = `hsla(${hue}, 70%, 60%, 0.45)`;
        const jitterX = s(spacingJitter(hash + index * 13, -22, 22));
        const jitterY = s(spacingJitter(hash + index * 29, -18, 18));

        let x = centerX + Math.cos(angle) * ringRadius + jitterX;
        let y = centerY + Math.sin(angle) * ringRadius + jitterY;
        x = Math.min(width - padding - radius, Math.max(padding + radius, x));
        y = Math.min(height - padding - radius, Math.max(padding + radius, y));

        return {
            name: lang.name,
            count: lang.count,
            percent,
            share,
            x,
            y,
            radius,
            accent,
            accentSoft,
        };
    });

    const titleBarStops = bubbles.length
        ? (() => {
            let offset = 0;
            return bubbles.map((bubble) => {
                const start = offset;
                offset = Math.min(100, offset + bubble.share);
                return `<stop offset="${start.toFixed(1)}%" stop-color="${bubble.accent}"/><stop offset="${offset.toFixed(1)}%" stop-color="${bubble.accent}"/>`;
            }).join('');
        })()
        : `<stop offset="0%" stop-color="${theme.iconColor}"/><stop offset="100%" stop-color="${theme.iconColor}"/>`;

    const starField = Array.from({ length: 70 }, (_, i) => {
        const x = ((i * 113) % width).toFixed(0);
        const y = ((i * 61) % height).toFixed(0);
        const r = s(1 + (i % 3)).toFixed(1);
        const opacity = (0.2 + (i % 4) * 0.08).toFixed(2);
        const duration = (i % 3 === 0 ? 3 : i % 3 === 1 ? 5 : 7);
        const begin = (i % 10) * 0.2;
        const minOpacity = (parseFloat(opacity) * 0.3).toFixed(2);

        return `
            <circle cx="${x}" cy="${y}" r="${r}" fill="${theme.textColor}" opacity="${opacity}">
                <animate attributeName="opacity" values="${opacity};${minOpacity};${opacity}" dur="${duration}s" begin="${begin}s" repeatCount="indefinite" />
            </circle>`;
    }).join('');

    const bubbleNodes = bubbles.map((bubble, index) => {
        const delay = ((index * 0.4) + (hashString(bubble.name) % 8) * 0.1).toFixed(1);
        const size = bubble.radius * 2;
        const corner = Math.max(s(6), Math.min(s(14), bubble.radius * 0.25));
        const frameLength = Math.max(s(10), Math.min(s(22), bubble.radius * 0.4));
        const frameInset = s(2);
        const x = bubble.x - bubble.radius;
        const y = bubble.y - bubble.radius;
        const innerX = x + frameInset;
        const innerY = y + frameInset;
        const innerW = size - frameInset * 2;
        const innerH = size - frameInset * 2;
        return `
            <g class="bubble" style="animation-delay:${delay}s">
                <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${corner.toFixed(1)}" fill="url(#bubbleFill)" opacity="0.2"/>
                <rect x="${(x + s(6)).toFixed(1)}" y="${(y + s(6)).toFixed(1)}" width="${(size - s(12)).toFixed(1)}" height="${(size - s(12)).toFixed(1)}" rx="${Math.max(s(2), corner - s(4)).toFixed(1)}" fill="none" stroke="${bubble.accentSoft}" stroke-width="${s(1).toFixed(1)}" opacity="0.55"/>
                <path d="M ${innerX.toFixed(1)} ${(innerY + frameLength).toFixed(1)} V ${innerY.toFixed(1)} H ${(innerX + frameLength).toFixed(1)}" fill="none" stroke="${bubble.accent}" stroke-width="${s(1.6).toFixed(1)}" stroke-linecap="round"/>
                <path d="M ${(innerX + innerW - frameLength).toFixed(1)} ${innerY.toFixed(1)} H ${(innerX + innerW).toFixed(1)} V ${(innerY + frameLength).toFixed(1)}" fill="none" stroke="${bubble.accent}" stroke-width="${s(1.6).toFixed(1)}" stroke-linecap="round"/>
                <path d="M ${innerX.toFixed(1)} ${(innerY + innerH - frameLength).toFixed(1)} V ${(innerY + innerH).toFixed(1)} H ${(innerX + frameLength).toFixed(1)}" fill="none" stroke="${bubble.accent}" stroke-width="${s(1.6).toFixed(1)}" stroke-linecap="round"/>
                <path d="M ${(innerX + innerW - frameLength).toFixed(1)} ${(innerY + innerH).toFixed(1)} H ${(innerX + innerW).toFixed(1)} V ${(innerY + innerH - frameLength).toFixed(1)}" fill="none" stroke="${bubble.accent}" stroke-width="${s(1.6).toFixed(1)}" stroke-linecap="round"/>
                <rect x="${(x + s(10)).toFixed(1)}" y="${(y + s(10)).toFixed(1)}" width="${(size - s(20)).toFixed(1)}" height="${(size - s(20)).toFixed(1)}" rx="${Math.max(s(2), corner - s(6)).toFixed(1)}" fill="url(#bubbleGlow)" opacity="0.22" filter="url(#glow)"/>
                <text x="${bubble.x.toFixed(1)}" y="${(bubble.y - s(8)).toFixed(1)}" text-anchor="middle" fill="${theme.textColor}" font-size="${si(18)}" font-weight="700" filter="url(#glow)">${bubble.name}</text>
                <text x="${bubble.x.toFixed(1)}" y="${(bubble.y + s(20)).toFixed(1)}" text-anchor="middle" fill="${bubble.accent}" font-size="${si(16)}" font-weight="600">${bubble.percent}%</text>
            </g>
        `;
    }).join('');

    const infoCard = (() => {
        if (!sortedLanguages.length || listLength <= 0) return '';

        const items = sortedLanguages.slice(0, listLength);
        const cardWidth = s(320);
        const headerHeight = s(32);
        const rowHeight = s(24);
        const listOffset = s(24);
        const frameInset = s(dataBorderFramePosition === 'out' ? -6 : 6);
        const cornerSize = s(10);
        const frameStroke = s(2);
        const cardHeight = headerHeight + (items.length * rowHeight) + s(14) + listOffset;
        const infoSeed = hashString(`info-${sortedLanguages[0]?.name ?? 'default'}`);
        const infoOffsetX = s(spacingJitter(infoSeed, -14, 14));
        const infoOffsetY = s(spacingJitter(infoSeed + 17, -10, 10));
        const cardX = width - padding - cardWidth + infoOffsetX;
        const cardY = height - padding - cardHeight + infoOffsetY;
        const cardAccent = bubbles[0]?.accent || theme.iconColor;
        const frameX = cardX + frameInset;
        const frameY = cardY + frameInset;
        const frameW = cardWidth - (frameInset * 2);
        const frameH = cardHeight - (frameInset * 2);

        const rows = items.map((item, idx) => {
            const itemPercent = Math.round((item.count / totalCount) * 100);
            const accent = bubbles.find((b) => b.name === item.name)?.accent || theme.iconColor;
            const y = cardY + headerHeight + listOffset + (idx * rowHeight) + s(10);
            return `
                <text x="${cardX + s(18)}" y="${y}" fill="${accent}" font-size="${si(14)}" font-weight="700">${idx + 1}.</text>
                <text x="${cardX + s(40)}" y="${y}" fill="${theme.textColor}" font-size="${si(14)}" font-weight="600">${item.name}</text>
                <text x="${cardX + cardWidth - s(18)}" y="${y}" text-anchor="end" fill="${accent}" font-size="${si(14)}" font-weight="700">${itemPercent}%</text>
            `;
        }).join('');

        return `
            <g class="info-card">
                <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${s(12)}" fill="${theme.bgColor}" opacity="0.6" stroke="${showDataBorderStroke ? cardAccent : 'none'}" stroke-width="${s(1)}"/>
                <path d="M ${frameX} ${frameY + cornerSize} V ${frameY} H ${frameX + cornerSize}" fill="none" stroke="${showDataBorderFrame ? cardAccent : 'none'}" stroke-width="${frameStroke}" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M ${frameX + frameW - cornerSize} ${frameY} H ${frameX + frameW} V ${frameY + cornerSize}" fill="none" stroke="${showDataBorderFrame ? cardAccent : 'none'}" stroke-width="${frameStroke}" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M ${frameX} ${frameY + frameH - cornerSize} V ${frameY + frameH} H ${frameX + cornerSize}" fill="none" stroke="${showDataBorderFrame ? cardAccent : 'none'}" stroke-width="${frameStroke}" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M ${frameX + frameW - cornerSize} ${frameY + frameH} H ${frameX + frameW} V ${frameY + frameH - cornerSize}" fill="none" stroke="${showDataBorderFrame ? cardAccent : 'none'}" stroke-width="${frameStroke}" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="${cardX + s(18)}" y="${cardY + s(28)}" fill="${theme.textColor}" font-size="${si(14)}" font-weight="700" letter-spacing="${s(1)}" opacity="0.85">TOP ${topLanguagesCount} LANGUAGES</text>
                <rect x="${cardX + s(14)}" y="${cardY + s(36)}" width="${cardWidth - s(28)}" height="${s(6)}" rx="${s(3)}" fill="url(#titleBarGradient)" opacity="0.95"/>
                ${rows}
            </g>
        `;
    })();

    return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bgGradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" style="stop-color:${theme.bgColor};stop-opacity:1" />
            <stop offset="50%" style="stop-color:#02030a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
        </radialGradient>

        <radialGradient id="nebulaGradient" cx="30%" cy="35%" r="65%">
            <stop offset="0%" style="stop-color:${theme.iconColor};stop-opacity:0.14" />
            <stop offset="50%" style="stop-color:${theme.titleColor};stop-opacity:0.07" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
        </radialGradient>

        <radialGradient id="galaxyGradient" cx="70%" cy="25%" r="60%">
            <stop offset="0%" style="stop-color:${theme.titleColor};stop-opacity:0.22" />
            <stop offset="45%" style="stop-color:${theme.iconColor};stop-opacity:0.12" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
        </radialGradient>

        <pattern id="gridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${theme.iconColor}" stroke-width="1" opacity="0.08"/>
        </pattern>

        <radialGradient id="bubbleFill" cx="35%" cy="35%" r="70%">
            <stop offset="0%" style="stop-color:${theme.bgColor};stop-opacity:0.9" />
            <stop offset="100%" style="stop-color:${theme.borderColor};stop-opacity:0.6" />
        </radialGradient>

        <radialGradient id="bubbleGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" style="stop-color:${theme.iconColor};stop-opacity:0.1" />
            <stop offset="100%" style="stop-color:${theme.titleColor};stop-opacity:0" />
        </radialGradient>

        <radialGradient id="planetBody" cx="35%" cy="35%" r="70%">
            <stop offset="0%" style="stop-color:${theme.titleColor};stop-opacity:0.55" />
            <stop offset="60%" style="stop-color:${theme.iconColor};stop-opacity:0.32" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:0.28" />
        </radialGradient>

        <radialGradient id="planetGlow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" style="stop-color:${theme.iconColor};stop-opacity:0.18" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
        </radialGradient>

        <linearGradient id="planetRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${theme.iconColor};stop-opacity:0" />
            <stop offset="50%" style="stop-color:${theme.iconColor};stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:${theme.iconColor};stop-opacity:0" />
        </linearGradient>

        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="${s(1.8).toFixed(1)}" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>

        <linearGradient id="titleBarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            ${titleBarStops}
        </linearGradient>
    </defs>

    <style>
        text {
            font-family: ${theme.fontFamily};
            font-weight: 700;
        }

        @keyframes floatY {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        @keyframes spaceFloat {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-6px, -4px); }
        }

        @keyframes spaceDrift {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(5px, 6px); }
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .bubble {
            animation: floatY 6s ease-in-out infinite;
            transform-origin: ${centerX}px ${centerY}px;
        }

        .space-icons {
            animation: spaceFloat 12s ease-in-out infinite;
        }

        .space-icons .ship-rocket {
            animation: spaceDrift 9s ease-in-out infinite;
        }

        .space-icons .ship-ufo {
            animation: spaceFloat 10s ease-in-out infinite reverse;
        }

        .rings {
            animation: spin 80s linear infinite;
            transform-origin: ${centerX}px ${centerY}px;
        }
    </style>

    <rect width="${width}" height="${height}" rx="12" fill="url(#bgGradient)" />
    <rect width="${width}" height="${height}" rx="12" fill="#000000" opacity="0.22" />
    <rect width="${width}" height="${height}" rx="12" fill="url(#nebulaGradient)" opacity="0.38" />
    <ellipse cx="860" cy="170" rx="240" ry="140" fill="url(#galaxyGradient)" opacity="0.6" />
    <rect width="${width}" height="${height}" rx="12" fill="url(#gridPattern)" opacity="0.18" />

    <g opacity="0.18">
        ${Array.from({ length: 24 }, (_, i) => {
            const x = (i + 1) * (width / 24);
            return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${theme.iconColor}" stroke-width="${s(0.5).toFixed(2)}"/>`;
        }).join('')}
        ${Array.from({ length: 12 }, (_, i) => {
            const y = (i + 1) * (height / 12);
            return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${theme.iconColor}" stroke-width="${s(0.5).toFixed(2)}"/>`;
        }).join('')}
    </g>

    <g>${starField}</g>

    <g class="space-icons" opacity="0.55">
        <g class="ship-rocket" transform="translate(${s(140)} ${s(220)})">
            <ellipse cx="0" cy="${s(10)}" rx="${s(10)}" ry="${s(16)}" fill="${theme.titleColor}" opacity="0.9" />
            <path d="M ${-s(10)} ${s(10)} L 0 ${-s(18)} L ${s(10)} ${s(10)} Z" fill="${theme.iconColor}" opacity="0.9" />
            <circle cx="0" cy="${s(4)}" r="${s(4)}" fill="${theme.textColor}" opacity="0.75" />
            <path d="M ${-s(5)} ${s(22)} L 0 ${s(32)} L ${s(5)} ${s(22)} Z" fill="${theme.iconColor}" opacity="0.7" />
        </g>
        <g class="ship-ufo" transform="translate(${s(195)} ${s(285)})">
            <ellipse cx="0" cy="0" rx="${s(20)}" ry="${s(6)}" fill="${theme.iconColor}" opacity="0.8" />
            <ellipse cx="0" cy="${-s(6)}" rx="${s(10)}" ry="${s(4)}" fill="${theme.titleColor}" opacity="0.8" />
            <circle cx="${-s(8)}" cy="0" r="${s(1.5)}" fill="${theme.textColor}" opacity="0.7" />
            <circle cx="0" cy="0" r="${s(1.5)}" fill="${theme.textColor}" opacity="0.7" />
            <circle cx="${s(8)}" cy="0" r="${s(1.5)}" fill="${theme.textColor}" opacity="0.7" />
        </g>
    </g>

    <g opacity="0.75">
        <circle cx="${centerX}" cy="${centerY}" r="${s(110)}" fill="url(#planetGlow)" opacity="0.6" />
        <circle cx="${centerX}" cy="${centerY}" r="${s(85)}" fill="url(#planetBody)" />
        <ellipse cx="${centerX}" cy="${centerY}" rx="${s(118)}" ry="${s(28)}" fill="url(#planetRim)" opacity="0.78" />
    </g>

    <g opacity="0.9">
        ${bubbleNodes}
    </g>

    <g class="rings" opacity="0.5">
        <circle cx="${centerX}" cy="${centerY}" r="${s(140)}" fill="none" stroke="${theme.iconColor}" stroke-dasharray="${s(10)} ${s(8)}" stroke-width="${s(1)}"/>
        <circle cx="${centerX}" cy="${centerY}" r="${s(210)}" fill="none" stroke="${theme.iconColor}" stroke-dasharray="${s(6)} ${s(10)}" stroke-width="${s(1)}" opacity="0.4"/>
    </g>

    <text class="title" x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" fill="${theme.titleColor}" font-size="${si(22)}" font-weight="700" letter-spacing="1">TOP LANGUAGES</text>

    ${infoCard}
</svg>
    `.trim();
}

async function main() {
    try {
        const languages = await getUserLanguages(USERNAME);
        console.log('Language stats found:', languages.slice(0, 8));

        const svgContent = generateLanguagesCard(languages);

        const projectRoot = path.resolve(__dirname, '..');
        const rootSvgPath = path.join(projectRoot, 'cyberpunk-languages.svg');
        fs.writeFileSync(rootSvgPath, svgContent, 'utf-8');
        console.log(`Saved card to ${rootSvgPath}`);

        const distDir = path.join(projectRoot, 'dist');
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }
        const distSvgPath = path.join(distDir, 'cyberpunk-languages.svg');
        fs.writeFileSync(distSvgPath, svgContent, 'utf-8');
        console.log(`Saved card to ${distSvgPath}`);
    } catch (err) {
        console.error('Failed to generate card:', err);
        process.exit(1);
    }
}

main();
