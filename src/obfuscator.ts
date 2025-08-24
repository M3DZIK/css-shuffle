import fs from "fs";
import { globby } from "globby";

import { exportCSSNames, generateRandomName } from './utils.js'

export async function obfuscate(baseDir: string, outputDir: string): Promise<Map<string, string>> {
    // copy baseDir to outputDir
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    fs.cpSync(baseDir, outputDir, { recursive: true });

    const htmlFiles = await globby(['**/*.html'], { cwd: outputDir, absolute: true });
    const cssFiles = await globby(['**/*.css'], { cwd: outputDir, absolute: true });

    let cssElementNum = 0;

    const globalClassMap = new Map<string, string>();
    const globalIdMap = new Map<string, string>();
    const globalVarMap = new Map<string, string>();

    for (const cssFile of cssFiles) {
        const cssFileContent = fs.readFileSync(cssFile, "utf8");
        const { classNames, idNames, varNames } = await exportCSSNames(cssFileContent);

        for (const name of classNames) {
            if (globalClassMap.has(name)) continue;
            cssElementNum++;
            const value = `${generateRandomName(cssElementNum)}`;
            globalClassMap.set(name, value);
        }
        for (const name of idNames) {
            if (globalIdMap.has(name)) continue;
            cssElementNum++;
            const value = `${generateRandomName(cssElementNum)}`;
            globalIdMap.set(name, value);
        }
        for (const name of varNames) {
            if (globalVarMap.has(name)) continue;
            cssElementNum++;
            const value = `${generateRandomName(cssElementNum)}`;
            globalVarMap.set(name, value);
        }
    }

    // get styles from <style> tags in html files
    for (const htmlFile of htmlFiles) {
        const htmlFileContent = fs.readFileSync(htmlFile, "utf8");
        const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let match: RegExpExecArray | null;

        while ((match = styleTagRegex.exec(htmlFileContent)) !== null) {
            const styleContent = match[1];
            const { classNames, idNames, varNames } = await exportCSSNames(styleContent);

            for (const name of classNames) {
                if (globalClassMap.has(name)) continue;
                cssElementNum++;
                const value = `${generateRandomName(cssElementNum)}`;
                globalClassMap.set(name, value);
            }
            for (const name of idNames) {
                if (globalIdMap.has(name)) continue;
                cssElementNum++;
                const value = `${generateRandomName(cssElementNum)}`;
                globalIdMap.set(name, value);
            }
            for (const name of varNames) {
                if (globalVarMap.has(name)) continue;
                cssElementNum++;
                const value = `${generateRandomName(cssElementNum)}`;
                globalVarMap.set(name, value);
            }
        }
    }

    // replace names in css files
    for (const cssFile of cssFiles) {
        let cssFileContent = fs.readFileSync(cssFile, "utf8");

        for (const [original, obfuscated] of globalClassMap) {
            const classRegex = new RegExp(`\\.(${original})(?![\\w-])`, 'g');
            cssFileContent = cssFileContent.replace(classRegex, `.${obfuscated}`);
        }
        for (const [original, obfuscated] of globalIdMap) {
            const idRegex = new RegExp(`#(${original})(?![\\w-])`, 'g');
            cssFileContent = cssFileContent.replace(idRegex, `#${obfuscated}`);
        }
        for (const [original, obfuscated] of globalVarMap) {
            const varRegex = new RegExp(`--(${original})(?![\\w-])`, 'g');
            cssFileContent = cssFileContent.replace(varRegex, `--${obfuscated}`);
        }
        // TODO: test this
        // replace also in @append classes
        const appendRegex = /@apply\s+([^;]+);/g;
        cssFileContent = cssFileContent.replace(appendRegex, (match, p1) => {
            const updatedClasses = p1.split(/\s+/).map(cls => {
                return globalClassMap.get(cls) || cls;
            }).join(' ');
            return `@apply ${updatedClasses};`;
        });

        fs.writeFileSync(cssFile, cssFileContent, "utf8");
    }

    // replace names in html files
    for (const htmlFile of htmlFiles) {
        let htmlFileContent = fs.readFileSync(htmlFile, "utf8");

        for (const [original, obfuscated] of globalClassMap) {
            const classAttrRegex = new RegExp(`class=["']([^"']*\\b${original}\\b[^"']*)["']`, 'g');
            htmlFileContent = htmlFileContent.replace(classAttrRegex, (match, p1) => {
                const updatedClasses = p1.split(/\s+/).map(cls => cls === original ? obfuscated : cls).join(' ');
                return `class="${updatedClasses}"`;
            });
        }
        for (const [original, obfuscated] of globalIdMap) {
            const idAttrRegex = new RegExp(`id=["']${original}["']`, 'g');
            htmlFileContent = htmlFileContent.replace(idAttrRegex, `id="${obfuscated}"`);
        }
        for (const [original, obfuscated] of globalVarMap) {
            const varRegex = new RegExp(`--(${original})(?![\\w-])`, 'g');
            htmlFileContent = htmlFileContent.replace(varRegex, `--${obfuscated}`);
        }

        // replace in style tags
        const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        htmlFileContent = htmlFileContent.replace(styleTagRegex, (match, p1) => {
            let styleContent = p1;

            for (const [original, obfuscated] of globalClassMap) {
                const classRegex = new RegExp(`\\.(${original})(?![\\w-])`, 'g');
                styleContent = styleContent.replace(classRegex, `.${obfuscated}`);
            }
            for (const [original, obfuscated] of globalIdMap) {
                const idRegex = new RegExp(`#(${original})(?![\\w-])`, 'g');
                styleContent = styleContent.replace(idRegex, `#${obfuscated}`);
            }
            for (const [original, obfuscated] of globalVarMap) {
                const varRegex = new RegExp(`--(${original})(?![\\w-])`, 'g');
                styleContent = styleContent.replace(varRegex, `--${obfuscated}`);
            }

            return `<style>${styleContent}</style>`;
        });

        fs.writeFileSync(htmlFile, htmlFileContent, "utf8");
    }

    // return mapping
    return new Map([
        ...globalClassMap,
        ...globalIdMap,
        ...globalVarMap,
    ]);
}
