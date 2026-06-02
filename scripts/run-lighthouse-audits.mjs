import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PAGES = [
    { name: 'Homepage', route: '/' },
    { name: 'Features', route: '/features' },
    { name: 'Pricing', route: '/pricing' },
    { name: 'Blog', route: '/blog' },
    { name: 'Blog Post', route: '/blog/how-to-plan-multi-city-trip' },
    { name: 'Inspirations', route: '/inspirations' },
    { name: 'FAQ', route: '/faq' },
    { name: 'Contact', route: '/contact' }
];

const PORT = Number(process.env.LIGHTHOUSE_PORT || 4173);
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL || `http://localhost:${PORT}`;
const OUT_DIR = path.resolve('tmp', 'perf');
const MIN_MARKETING_SCORE = Number(process.env.LIGHTHOUSE_MIN_MARKETING_SCORE || 95);

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('Starting automated Lighthouse audits...');
console.log(`Target Preview Server: ${BASE_URL}\n`);

const results = [];
const auditFailures = [];

for (const page of PAGES) {
    const url = `${BASE_URL}${page.route}`;
    const filename = `${page.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const jsonPath = path.join(OUT_DIR, `${filename}.json`);
    
    console.log(`Auditing ${page.name} (${page.route})...`);
    
    try {
        // Run lighthouse CLI in headless chrome
        const cmd = `npx lighthouse ${url} ` +
            `--chrome-flags="--headless --no-sandbox --disable-gpu" ` +
            `--only-categories=performance ` +
            `--output=json ` +
            `--output-path=${jsonPath}`;
        
        execSync(cmd, { stdio: 'ignore' });
        
        // Parse the generated JSON report
        if (fs.existsSync(jsonPath)) {
            const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const score = Math.round(report.categories.performance.score * 100);
            const fcp = report.audits['first-contentful-paint']?.displayValue || 'N/A';
            const lcp = report.audits['largest-contentful-paint']?.displayValue || 'N/A';
            const tbt = report.audits['total-blocking-time']?.displayValue || 'N/A';
            const cls = report.audits['cumulative-layout-shift']?.displayValue || 'N/A';
            const lcpAudit = report.audits['lcp-breakdown-insight'] || report.audits['largest-contentful-paint-element'];
            const lcpNode = lcpAudit?.details?.items?.[1]?.selector || lcpAudit?.details?.items?.[0]?.node?.selector || 'Unknown';
            
            console.log(`✓ ${page.name}: Performance Score = ${score} (FCP: ${fcp}, LCP: ${lcp}, TBT: ${tbt})`);
            
            results.push({
                name: page.name,
                route: page.route,
                score,
                fcp,
                lcp,
                tbt,
                cls,
                lcpNode,
                jsonFile: path.relative(process.cwd(), jsonPath)
            });
        } else {
            console.error(`✗ Failed to find report for ${page.name} at ${jsonPath}`);
        }
    } catch (err) {
        console.error(`✗ Error auditing ${page.name}:`, err.message);
        auditFailures.push({ name: page.name, route: page.route, reason: err.message });
    }
}

// Generate summary report
console.log('\nGenerating summary report...');

let markdown = `# Lighthouse Performance Audits Summary\n\n`;
markdown += `Run date: ${new Date().toISOString()}\n`;
markdown += `Environment: ${BASE_URL}\n\n`;
markdown += `| Page | Route | Performance Score | FCP | LCP | TBT | CLS | LCP Target Element | Report File |\n`;
markdown += `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;

for (const r of results) {
    markdown += `| ${r.name} | \`${r.route}\` | **${r.score}** | ${r.fcp} | ${r.lcp} | ${r.tbt} | ${r.cls} | \`${r.lcpNode.replace(/\|/g, '\\|')}\` | [JSON](./${path.basename(r.jsonFile)}) |\n`;
}

const summaryPath = path.join(OUT_DIR, 'summary.md');
fs.writeFileSync(summaryPath, markdown, 'utf8');

console.log(`\nSummary report generated at ${summaryPath}`);
console.log('\n' + markdown);

if (auditFailures.length > 0 || results.length !== PAGES.length) {
    console.error(
        `\nLighthouse audit failed to complete for: `
        + auditFailures.map((page) => `${page.name} (${page.route})`).join(', ')
    );
    process.exit(1);
}

const failingPages = results.filter((result) => result.score < MIN_MARKETING_SCORE);
if (failingPages.length > 0) {
    console.error(
        `\nLighthouse marketing threshold failed (${MIN_MARKETING_SCORE}+ required): `
        + failingPages.map((page) => `${page.name}=${page.score}`).join(', ')
    );
    process.exit(1);
}
