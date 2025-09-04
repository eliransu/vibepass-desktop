'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { mdToPdf } = require('md-to-pdf');

function getProjectRoot() {
    return __dirname ? path.resolve(__dirname, '..') : process.cwd();
}

async function renderOne(inputPath, outputPath) {
    const result = await mdToPdf({ path: inputPath }, {
        dest: outputPath,
        pdf_options: {
            format: 'A4',
            printBackground: true,
            margin: '20mm',
        },
    });
    if (!result || !result.filename) {
        throw new Error('Failed to render: ' + inputPath);
    }
}

async function main() {
    const root = getProjectRoot();
    const legalDir = path.join(root, 'LEGAL');
    const targets = [
        { in: path.join(legalDir, 'Terms_of_Use.md'), out: path.join(legalDir, 'Terms_of_Use.pdf') },
        { in: path.join(legalDir, 'Privacy_Policy.md'), out: path.join(legalDir, 'Privacy_Policy.pdf') },
    ];

    for (const t of targets) {
        if (!fs.existsSync(t.in)) {
            continue;
        }
        process.stdout.write(`Rendering ${path.basename(t.in)} -> ${path.basename(t.out)}\n`);
        await renderOne(t.in, t.out);
    }
    process.stdout.write('Done.\n');
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { renderOne, getProjectRoot };
