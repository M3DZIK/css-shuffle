import fs from "fs";
import { globby } from "globby";
import * as csstree from "css-tree";

import { Renamer } from "./renamer.js";

export class Obfuscator {
    private renamer = new Renamer();

    private obfuscateName(originalName: string): string {
        return this.renamer.rename(originalName);
    }

    getMapping(): Map<string, string> {
        return this.renamer.renames;
    }

    getMappingJSON(): string {
        return JSON.stringify(Object.fromEntries(this.getMapping()), null, 2);
    }

    obfuscateCSS(css: string): string {
        const ast = csstree.parse(css);
        csstree.walk(ast, (node) => {
            // Obfuscate class names
            if (node.type === 'ClassSelector') {
                const originalName = node.name;
                const obfuscatedName = this.obfuscateName(originalName);
                node.name = obfuscatedName;
            }

            // Obfuscate ID names
            if (node.type === 'IdSelector') {
                const originalName = node.name;
                const obfuscatedName = this.obfuscateName(originalName);
                node.name = obfuscatedName;
            }

            // Obfuscate custom property names (CSS variables)
            if (node.type === 'Declaration' && node.property.startsWith('--')) {
                const originalName = node.property;
                const obfuscatedName = this.obfuscateName(originalName);
                node.property = obfuscatedName;
            }

            // Obfuscate var() references
            if (node.type === 'Function' && node.name === 'var' && node.children.size > 0) {
                const firstChild = node.children.first;
                if (firstChild && firstChild.type === 'Identifier' && firstChild.name.startsWith('--')) {
                    const originalName = firstChild.name;
                    const obfuscatedName = this.obfuscateName(originalName);
                    firstChild.name = obfuscatedName;
                }
            }

            // TODO: Obfuscate keyframe names
        });

        // Return obfuscated CSS
        return csstree.generate(ast);
    }

    private obfuscateCSSInHtml(html: string): string {
        const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        return html.replace(styleTagRegex, (match, p1) => {
            let styleContent = p1;
            styleContent = this.obfuscateCSS(styleContent);
            return `<style>${styleContent}</style>`;
        });
    }

    private replaceNamesInHtml(html: string): string {
        let result = html;
        for (const [originalName, obfuscatedName] of this.getMapping()) {
            // Replace class names
            const classRegex = new RegExp(`class=["']([^"']*\\b${originalName}\\b[^"']*)["']`, 'g');
            result = result.replace(classRegex, (match, p1) => {
                const updatedClasses = p1.split(/\s+/).map(cls => cls === originalName ? obfuscatedName : cls).join(' ');
                return `class="${updatedClasses}"`;
            });

            // Replace id names
            const idRegex = new RegExp(`id=["']${originalName}["']`, 'g');
            result = result.replace(idRegex, `id="${obfuscatedName}"`);

            // Replace CSS variable references in style attributes
            const varRegex = new RegExp(`--(${originalName})(?![\\w-])`, 'g');
            result = result.replace(varRegex, `--${obfuscatedName}`);
        }
        return result;
    }

    async obfuscateAndExport(input: string, output: string) {
        if (input != output) {
            // copy files from input dir to output dir
            if (fs.existsSync(output)) {
                fs.rmSync(output, { recursive: true, force: true });
            }
            fs.mkdirSync(output, { recursive: true });
            fs.cpSync(input, output, { recursive: true });
        }

        const htmlFiles = await globby(['**/*.html'], { cwd: output, absolute: true });
        const cssFiles = await globby(['**/*.css'], { cwd: output, absolute: true });

        // Obfuscate CSS files
        for (const cssFile of cssFiles) {
            const cssContent = fs.readFileSync(cssFile, 'utf-8');
            const obfuscatedCss = this.obfuscateCSS(cssContent);
            fs.writeFileSync(cssFile, obfuscatedCss, 'utf-8');
        }

        // Obfuscate CSS in <style> tag in HTML files and export obfuscated names to HTML
        for (const htmlFile of htmlFiles) {
            let htmlContent = fs.readFileSync(htmlFile, 'utf-8');
            htmlContent = this.obfuscateCSSInHtml(htmlContent);
            htmlContent = this.replaceNamesInHtml(htmlContent);
            fs.writeFileSync(htmlFile, htmlContent, 'utf-8');
        }
    }
}
