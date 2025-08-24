import postcss from "postcss";
import selectorParser from 'postcss-selector-parser';

export function generateRandomName(nameNum: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let name = '';
    while (nameNum > 0) {
        nameNum--; // Adjust for 0-based index
        name = chars[nameNum % chars.length] + name;
        nameNum = Math.floor(nameNum / chars.length);
    }
    return name;
}

export async function exportCSSNames(cssContent: string) {
    const classSet = new Set<string>();
    const idSet = new Set<string>();
    const varNames = new Set<string>();

    await postcss([
        (root: postcss.Root) => {
            root.walkRules(rule => {
                selectorParser(selectors => {
                    selectors.walkClasses(node => { classSet.add(node.value); });
                    selectors.walkIds(node => { idSet.add(node.value); });
                }).processSync(rule.selector);
            });
        }
    ]).process(cssContent, { from: undefined });

    const varRegex = /--([a-zA-Z0-9_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(cssContent)) !== null) {
        varNames.add(match[1]);
    }

    return {
        classNames: Array.from(classSet),
        idNames: Array.from(idSet),
        varNames: Array.from(varNames),
    };
}
