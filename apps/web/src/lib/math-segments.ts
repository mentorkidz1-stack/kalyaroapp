// Découpe un texte mêlant prose et formules LaTeX : $…$ (en ligne) et $$…$$ (bloc).
//
// Rétrocompatibilité : un texte sans délimiteur valide ressort en un seul segment de prose,
// donc s'affiche exactement comme avant. Les règles de délimitation (reprises de Pandoc)
// évitent de prendre un montant pour une formule : "$" ouvrant suivi d'un espace, "$"
// fermant précédé d'un espace ou suivi d'un chiffre, ou formule sur plusieurs lignes →
// le "$" reste un caractère ordinaire. "\$" donne toujours un "$" littéral.

export type MathSegment =
  | { type: "texte"; contenu: string }
  | { type: "en_ligne"; tex: string }
  | { type: "bloc"; tex: string };

export function decouperMath(texte: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let prose = "";
  const pousserProse = () => {
    if (prose) segments.push({ type: "texte", contenu: prose });
    prose = "";
  };

  let i = 0;
  while (i < texte.length) {
    const c = texte[i];

    if (c === "\\" && texte[i + 1] === "$") {
      prose += "$";
      i += 2;
      continue;
    }

    // Délimiteurs LaTeX \( … \) et \[ … \] : la consigne demande $…$, mais les modèles
    // d'IA les emploient régulièrement ; on les accepte plutôt que d'afficher du code brut.
    if (c === "\\" && (texte[i + 1] === "(" || texte[i + 1] === "[")) {
      const fermeture = texte[i + 1] === "(" ? "\\)" : "\\]";
      const fin = texte.indexOf(fermeture, i + 2);
      const tex = fin === -1 ? "" : texte.slice(i + 2, fin).trim();
      if (tex) {
        pousserProse();
        segments.push({ type: texte[i + 1] === "(" ? "en_ligne" : "bloc", tex });
        i = fin + 2;
        continue;
      }
    }

    if (c === "$" && texte[i + 1] === "$") {
      const fin = texte.indexOf("$$", i + 2);
      const tex = fin === -1 ? "" : texte.slice(i + 2, fin).trim();
      if (tex) {
        pousserProse();
        segments.push({ type: "bloc", tex });
        i = fin + 2;
        continue;
      }
      prose += "$$";
      i += 2;
      continue;
    }

    if (c === "$") {
      const fin = chercherFinEnLigne(texte, i + 1);
      if (fin !== -1) {
        pousserProse();
        segments.push({ type: "en_ligne", tex: texte.slice(i + 1, fin) });
        i = fin + 1;
        continue;
      }
    }

    prose += c;
    i++;
  }
  pousserProse();
  return segments;
}

function chercherFinEnLigne(texte: string, debut: number): number {
  const premier = texte[debut];
  if (premier === undefined || /\s/.test(premier) || premier === "$") return -1;
  for (let j = debut; j < texte.length; j++) {
    const c = texte[j];
    if (c === "\n") return -1;
    if (c === "\\") {
      j++; // caractère échappé à l'intérieur de la formule (ex. \$ ou \{)
      continue;
    }
    if (c === "$") {
      const avant = texte[j - 1]!;
      const apres = texte[j + 1];
      if (/\s/.test(avant) || (apres !== undefined && /\d/.test(apres))) return -1;
      return j;
    }
  }
  return -1;
}

export function contientMath(segments: MathSegment[]): boolean {
  return segments.some((s) => s.type !== "texte");
}
