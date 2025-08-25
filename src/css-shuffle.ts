import fs from "fs";
import { globby } from "globby";
import * as cheerio from "cheerio";
import { Table } from "console-table-printer";
import prettyBytes from "pretty-bytes";
import postcss, { Root } from "postcss";
import selectorParser from "postcss-selector-parser";
import valueParser from "postcss-value-parser";

import { Renamer } from "./renamer.js";

export class CSSShuffle {
    private renamer = new Renamer();

    // private readonly stats = new Table();

    private readonly stats = new Map<string, {orginalSize: number, newSize: number}>()

    private obfuscateName(originalName: string): string {
        return this.renamer.rename(originalName);
    }

    private getObfuscateName(key: string): string {
        return this.renamer.get(key)
    }

    getMapping(): Map<string, string> {
        return this.renamer.renames;
    }

    getMappingJSON(): string {
        return JSON.stringify(Object.fromEntries(this.getMapping()), null, 2);
    }

    saveMappingJSON(path: string) {
        const mapping = this.getMappingJSON()

        fs.writeFileSync(path, mapping)
    }

    async obfuscateCSS(css: string): Promise<string> {
        return await postcss([
            (root: Root) => {
                root.walkRules(rule => {
                    rule.selector = selectorParser(selectors => {
                        selectors.walkClasses(node => { node.value = this.obfuscateName(node.value) });
                        selectors.walkIds(node => { node.value = this.obfuscateName(node.value) });
                        }).processSync(rule.selector);
                    });

                    root.walkDecls(decl => {
                        if (decl.prop.startsWith("--")) {
                            decl.prop = `--${this.obfuscateName(decl.prop.substring(2))}`
                        }

                        const parsedValue = valueParser(decl.value);
                        parsedValue.walk(node => {
                        if (node.type === 'function' && node.value === 'var' && node.nodes[0]) {
                            node.nodes[0].value = `--${this.obfuscateName(node.nodes[0].value.substring(2))}`;
                        }
                        });
                        decl.value = parsedValue.toString();
                    })
                }
            ]).process(css, { from: undefined }).then(result => result.css);
    }

    private obfuscateCSSInHtml(html: string): string {
        const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        return html.replace(styleTagRegex, (_, p1) => {
            let styleContent = p1;
            styleContent = this.obfuscateCSS(styleContent);
            return `<style>${styleContent}</style>`;
        });
    }

    private replaceNamesInHtml(html: string): string {
        const $ = cheerio.load(html);

        $('[class]').each((_, e) => {
            const classes = $(e).attr('class').split(/\s+/).filter(Boolean);
            const newClasses = classes.map(cls => this.getObfuscateName(cls) || cls);
            $(e).attr('class', newClasses.join(' '));
        })

        $('[id]').each((_, e) => {
            const id = $(e).attr('id');
            $(e).attr('id', this.getObfuscateName(id));
        })

        $('[for]').each((_, e) => {
            const id = $(e).attr('for');
            $(e).attr('for', this.getObfuscateName(id));
        })

        $('a[href^="#"]').each((_, e) => {
            const href = $(e).attr('href');
            const target = href.slice(1);
            $(e).attr('href', '#' + this.getObfuscateName(target));
        });

        return $.html();
    }

    async obfuscate(input: string, dist?: string) {
        if (dist == undefined) {
            dist = input
        }

        if (input != dist) {
            // copy files from input dir to output dir
            if (fs.existsSync(dist)) {
                fs.rmSync(dist, { recursive: true, force: true });
            }
            fs.mkdirSync(dist, { recursive: true });
            fs.cpSync(input, dist, { recursive: true });
        }

        const htmlFiles = await globby(['**/*.html'], { cwd: dist, absolute: true });
        const cssFiles = await globby(['**/*.css'], { cwd: dist, absolute: true });

        // Obfuscate CSS files
        for (const cssFile of cssFiles) {
            const cssContent = fs.readFileSync(cssFile, 'utf-8');
            const obfuscatedCss = await this.obfuscateCSS(cssContent);
            fs.writeFileSync(cssFile, obfuscatedCss, 'utf-8');

            const oldSize = cssContent.length
            const newSize = obfuscatedCss.length
            if (oldSize != newSize) {
                const fileName = cssFile.replace(dist, '');
                this.stats.set(fileName, {
                    orginalSize: oldSize,
                    newSize: newSize
                })
            }
        }

        // Obfuscate CSS in <style> tag in HTML files
        for (const htmlFile of htmlFiles) {
            const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
            let obfuscatedHtmlContent = this.obfuscateCSSInHtml(htmlContent);
            fs.writeFileSync(htmlFile, obfuscatedHtmlContent, 'utf-8');

            const oldSize = htmlContent.length
            const newSize = obfuscatedHtmlContent.length
            if (oldSize != newSize) {
                const fileName = htmlFile.replace(dist, '');
                this.stats.set(fileName, {
                    orginalSize: oldSize,
                    newSize: newSize
                })
            }
        }

        // Export export obfuscated names to HTML
        for (const htmlFile of htmlFiles) {
            const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
            let newHtmlContent = this.replaceNamesInHtml(htmlContent);
            fs.writeFileSync(htmlFile, newHtmlContent, 'utf-8');

            let orginalSize = htmlContent.length
            const newSize = newHtmlContent.length
            if (orginalSize != newSize) {
                const fileName = htmlFile.replace(dist, '');

                // this file maybe already obfuscated so get the really orginal file size
                const fileStats = this.stats.get(fileName)
                if (fileStats != undefined) orginalSize = fileStats.orginalSize

                this.stats.set(fileName, {
                    orginalSize: orginalSize,
                    newSize: newSize
                })
            }
        }
    }

    printStatsTable() {
        const table = new Table();

        this.stats.forEach((stats, file) => {
            table.addRow({
                File: file,
                'Original Size': prettyBytes(stats.orginalSize),
                'New Size': prettyBytes(stats.newSize),
                Reduced: `${(((stats.orginalSize - stats.newSize) / stats.orginalSize) * 100) | 0}%`,
            })
        });

        table.printTable()
    }
}
