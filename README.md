# CSS Shuffle

**CSS Shuffle** is a tool for obfuscating CSS and HTML files by randomizing all CSS class names, IDs, and CSS custom properties (variables).  

---

## Features

- Obfuscates all CSS class names, IDs, and custom properties (variables)
- Updates references in HTML (`class`, `id`, and inline style attributes)
- Handles both external CSS files and inline `<style>` tags in HTML
- Outputs a mapping file for reference

---

## Installation

```sh
git clone https://github.com/your-username/css-shuffle.git
cd css-shuffle
npm install
```

---

## Usage

```js
import { Obfuscator } from "./src/obfuscator.js";

const obfuscator = new Obfuscator();
await obfuscator.obfuscateAndExport("input-directory", "output-directory");
```

- `input-directory`: Path to your source files (HTML and CSS)
- `output-directory`: Path where the obfuscated website files will be written

**Example:**

```js
await obfuscator.obfuscateAndExport("./public", "./dist");
```

---

## How It Works

1. **Copies** all files from the input directory to the output directory.
2. **Obfuscates** all CSS class names, IDs, and variables in CSS files and inline `<style>` tags.
3. **Replaces** all references in HTML (`class`, `id`, and inline style attributes).
4. **Outputs** the obfuscated files and a mapping (see below).

---

## Mapping

You can get the mapping of original to obfuscated names:

```js
console.log(obfuscator.getMappingJSON());
```

---

## Requirements

- Node.js
- npm, yarn or something else

---

## License

MIT

---

**Note:**
This tool is intended for code obfuscation and not for security. Use responsibly!

After obfuscation, **please thoroughly check your obfuscated website for any bugs or issues**.  
If you notice anything not working as expected, or if you find a bug caused by the obfuscation process, **please create an issue** in the repository with details and, if possible, steps to reproduce.
