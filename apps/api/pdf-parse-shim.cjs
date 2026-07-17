// pdf-parse (via son bundle pdf.js interne) échoue silencieusement ("bad XRef entry" sur
// des PDF pourtant valides) dès qu'il est chargé depuis un module ESM natif — y compris
// via createRequire() appelé directement en ESM. Le require() imbriqué de pdf-parse
// (require(`./pdf.js/${version}/build/pdf.js`)) ne se comporte correctement que depuis
// une vraie limite de module CommonJS. Ce fichier .cjs sert donc de pont : peu importe
// comment il est chargé (createRequire depuis ESM, etc.), Node l'exécute toujours en CJS
// pur, ce qui rend son propre require("pdf-parse") fiable.
module.exports = require("pdf-parse");
