import { obfuscate } from "./obfuscator.js";

async function main() {
    const mapping = await obfuscate("./example", "./example-dist");

    console.log("Obfuscation mapping:");
    for (const [original, obfuscated] of mapping) {
        console.log(`${original} -> ${obfuscated}`);
    }
}

main();

export default obfuscate;
