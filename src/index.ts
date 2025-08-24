import { Obfuscator } from "./obfuscator.js";

async function main() {
    const obfuscator = new Obfuscator();

    await obfuscator.obfuscateAndExport("./example", "./example-dist");

    console.log("Obfuscation mapping:");
    for (const [original, obfuscated] of obfuscator.getMapping()) {
        console.log(`${original} -> ${obfuscated}`);
    }

    console.log(obfuscator.getMappingJSON());
}

main();

export { Obfuscator } from "./obfuscator.js";
