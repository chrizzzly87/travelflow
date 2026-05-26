import { generate } from 'critical';
import fs from 'fs';
import path from 'path';

async function runStaticTest() {
    console.log('--- Test 1: Running Critical on Static dist/index.html ---');
    const srcHtml = 'dist/index.html';
    const destHtml = 'dist/index-critical-static.html';
    
    if (!fs.existsSync(srcHtml)) {
        console.error(`Error: Source file ${srcHtml} does not exist.`);
        return;
    }
    
    try {
        const { css } = await generate({
            inline: true,
            base: 'dist/',
            src: 'index.html',
            target: 'index-critical-static.html',
            width: 1300,
            height: 900,
            extract: false,
        });
        
        const origSize = fs.statSync(srcHtml).size;
        const newSize = fs.statSync(destHtml).size;
        console.log(`✓ Completed Static Test.`);
        console.log(`Original HTML size: ${origSize} bytes`);
        console.log(`Critical HTML size: ${newSize} bytes (Delta: +${newSize - origSize} bytes)`);
        console.log(`Extracted CSS length: ${css ? css.length : 0} chars`);
    } catch (err) {
        console.error('✗ Static Test failed:', err.message);
    }
}

async function runLiveTest() {
    console.log('\n--- Test 2: Running Critical on Live Rendered URL http://localhost:4173/ ---');
    const destHtml = 'dist/index-critical-live.html';
    
    try {
        const { html, css } = await generate({
            inline: true,
            base: 'dist/',
            src: 'http://localhost:4173/',
            target: 'index-critical-live.html',
            width: 1300,
            height: 900,
            extract: false,
        });
        
        const newSize = fs.statSync(destHtml).size;
        console.log(`✓ Completed Live Test.`);
        console.log(`Generated HTML size: ${newSize} bytes`);
        console.log(`Extracted CSS length: ${css ? css.length : 0} chars`);
        
        // Inspect the generated HTML to see if it includes full React rendered nodes
        const content = fs.readFileSync(destHtml, 'utf8');
        const hasRootContent = content.includes('div id="root"') && content.split('div id="root"')[1].trim().startsWith('>');
        console.log(`Does HTML contain pre-rendered React DOM inside #root? ${!hasRootContent ? 'No (Skeleton only)' : 'Yes'}`);
        
        // Count style tags and their sizes
        const styleMatches = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
        console.log(`Found ${styleMatches.length} <style> block(s) in critical HTML.`);
        for (let i = 0; i < styleMatches.length; i++) {
            console.log(`Style Block #${i + 1} size: ${styleMatches[i][1].length} chars`);
        }
    } catch (err) {
        console.error('✗ Live Test failed:', err.message);
    }
}

async function main() {
    await runStaticTest();
    await runLiveTest();
}

main();
