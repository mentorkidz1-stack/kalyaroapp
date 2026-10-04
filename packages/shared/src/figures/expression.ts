// Interpréteur d'expressions mathématiques d'une variable x, pour tracer les courbes des
// figures. JAMAIS d'eval : une figure vient souvent de l'IA, on n'exécute pas son texte.
//
// Accepte l'écriture « de cahier » : 2x, 0,5x², −3x + 1, √x, √(x+1), ln(x), e^x, |x|, π,
// (x+1)(x−2), 3·x, x^-1, 2sqrt(x). Fonctions : sqrt/racine, ln, log (base 10), exp, abs,
// sin, cos, tan. Constantes : pi/π, e.

type Noeud =
  | { t: "nombre"; v: number }
  | { t: "x" }
  | { t: "unaire"; arg: Noeud }
  | { t: "binaire"; op: "+" | "-" | "*" | "/" | "^"; g: Noeud; d: Noeud }
  | { t: "fonction"; nom: string; arg: Noeud };

type Jeton =
  | { t: "nombre"; v: number }
  | { t: "ident"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "("; }
  | { t: ")"; }
  | { t: "|"; }
  | { t: "√"; };

const FONCTIONS: Record<string, (v: number) => number> = {
  sqrt: Math.sqrt,
  racine: Math.sqrt,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};
const CONSTANTES: Record<string, number> = { pi: Math.PI, "π": Math.PI, e: Math.E };
const EXPOSANTS: Record<string, string> = { "²": "2", "³": "3", "⁴": "4" };
const LONGUEUR_MAX = 200;

class ErreurExpression extends Error {}

function decouper(source: string): Jeton[] {
  const s = source
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[²³⁴]/g, (c) => `^${EXPOSANTS[c]}`);
  const jetons: Jeton[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c) || (c === "," && /[0-9]/.test(s[i + 1] ?? "") && /[0-9]/.test(s[i - 1] ?? ""))) {
      // Virgule décimale française (0,5) acceptée : les fonctions n'ont qu'un argument.
      let n = "";
      while (i < s.length && (/[0-9.]/.test(s[i]!) || (s[i] === "," && /[0-9]/.test(s[i + 1] ?? "")))) {
        n += s[i] === "," ? "." : s[i];
        i++;
      }
      const v = Number(n);
      if (!Number.isFinite(v)) throw new ErreurExpression(`Nombre invalide « ${n} »`);
      jetons.push({ t: "nombre", v });
    } else if (/[a-zA-Zπ]/.test(c)) {
      let id = "";
      while (i < s.length && /[a-zA-Zπ]/.test(s[i]!)) id += s[i++];
      // x, e et π collés (« πx », « xe ») sont découpés en produit, comme sur un cahier.
      const nom = id.toLowerCase();
      if (nom === "x" || nom in FONCTIONS || nom in CONSTANTES) jetons.push({ t: "ident", v: nom });
      else if (/^(x|e|pi|π)+$/.test(nom)) {
        for (const morceau of nom.match(/pi|π|x|e/g)!) jetons.push({ t: "ident", v: morceau });
      } else throw new ErreurExpression(`Nom inconnu « ${id} »`);
    } else if ("+-*/^".includes(c)) {
      jetons.push({ t: "op", v: c as "+" }); // le type exact est vérifié par includes
      i++;
    } else if (c === "(" || c === "[") {
      jetons.push({ t: "(" });
      i++;
    } else if (c === ")" || c === "]") {
      jetons.push({ t: ")" });
      i++;
    } else if (c === "|") {
      jetons.push({ t: "|" });
      i++;
    } else if (c === "√") {
      jetons.push({ t: "√" });
      i++;
    } else {
      throw new ErreurExpression(`Caractère non reconnu « ${c} »`);
    }
  }
  return jetons;
}

function analyser(jetons: Jeton[]): Noeud {
  let pos = 0;
  let valeursAbsoluesOuvertes = 0;
  const voir = () => jetons[pos];
  const prendre = () => jetons[pos++];

  function expression(): Noeud {
    let n = terme();
    for (let j = voir(); j?.t === "op" && (j.v === "+" || j.v === "-"); j = voir()) {
      prendre();
      n = { t: "binaire", op: j.v, g: n, d: terme() };
    }
    return n;
  }

  /** Un jeton qui peut commencer un facteur : sert à la multiplication implicite (2x, 3(x+1)). */
  function debutFacteur(j: Jeton | undefined): boolean {
    if (!j) return false;
    if (j.t === "|") return valeursAbsoluesOuvertes === 0; // un « | » ouvrant, pas fermant
    return j.t === "nombre" || j.t === "ident" || j.t === "(" || j.t === "√";
  }

  function terme(): Noeud {
    let n = unaire();
    for (;;) {
      const j = voir();
      if (j?.t === "op" && (j.v === "*" || j.v === "/")) {
        prendre();
        n = { t: "binaire", op: j.v, g: n, d: unaire() };
      } else if (debutFacteur(j)) {
        n = { t: "binaire", op: "*", g: n, d: puissance() };
      } else {
        return n;
      }
    }
  }

  function unaire(): Noeud {
    const j = voir();
    if (j?.t === "op" && (j.v === "-" || j.v === "+")) {
      prendre();
      const arg = unaire();
      return j.v === "-" ? { t: "unaire", arg } : arg;
    }
    return puissance();
  }

  function puissance(): Noeud {
    const base = primaire();
    const j = voir();
    if (j?.t === "op" && j.v === "^") {
      prendre();
      return { t: "binaire", op: "^", g: base, d: unaire() }; // associatif à droite, x^-1 permis
    }
    return base;
  }

  function primaire(): Noeud {
    const j = prendre();
    if (!j) throw new ErreurExpression("Expression incomplète");
    if (j.t === "nombre") return { t: "nombre", v: j.v };
    if (j.t === "(") {
      const n = expression();
      if (prendre()?.t !== ")") throw new ErreurExpression("Parenthèse fermante manquante");
      return n;
    }
    if (j.t === "|") {
      valeursAbsoluesOuvertes++;
      const n = expression();
      valeursAbsoluesOuvertes--;
      if (prendre()?.t !== "|") throw new ErreurExpression("Barre de valeur absolue manquante");
      return { t: "fonction", nom: "abs", arg: n };
    }
    if (j.t === "√") {
      // √x, √(x+1), √2x = √(2)·x comme sur un cahier : la racine porte sur le facteur suivant.
      return { t: "fonction", nom: "sqrt", arg: puissance() };
    }
    if (j.t === "ident") {
      if (j.v === "x") return { t: "x" };
      if (j.v in CONSTANTES) return { t: "nombre", v: CONSTANTES[j.v]! };
      // Fonction : parenthèses facultatives pour un argument simple (ln x, sin 2x → sin(2)·x évité :
      // sans parenthèse, la fonction ne s'applique qu'au facteur suivant).
      const suivant = voir();
      const arg = suivant?.t === "(" ? primaire() : puissance();
      return { t: "fonction", nom: j.v, arg };
    }
    throw new ErreurExpression("Expression mal formée");
  }

  const racine = expression();
  if (pos < jetons.length) throw new ErreurExpression("Expression mal formée (élément en trop)");
  return racine;
}

function evaluer(n: Noeud, x: number): number {
  switch (n.t) {
    case "nombre":
      return n.v;
    case "x":
      return x;
    case "unaire":
      return -evaluer(n.arg, x);
    case "fonction":
      return FONCTIONS[n.nom]!(evaluer(n.arg, x));
    case "binaire": {
      const g = evaluer(n.g, x);
      const d = evaluer(n.d, x);
      if (n.op === "+") return g + d;
      if (n.op === "-") return g - d;
      if (n.op === "*") return g * d;
      if (n.op === "/") return g / d;
      return Math.pow(g, d);
    }
  }
}

export type FonctionCompilee = (x: number) => number;

export function compilerExpression(source: string): { ok: true; f: FonctionCompilee } | { ok: false; erreur: string } {
  if (!source.trim()) return { ok: false, erreur: "Expression vide" };
  if (source.length > LONGUEUR_MAX) return { ok: false, erreur: "Expression trop longue" };
  try {
    const arbre = analyser(decouper(source));
    return { ok: true, f: (x: number) => evaluer(arbre, x) };
  } catch (e) {
    return { ok: false, erreur: e instanceof ErreurExpression ? e.message : "Expression invalide" };
  }
}
