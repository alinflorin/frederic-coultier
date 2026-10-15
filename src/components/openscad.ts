import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const KEYWORDS = new Set([
  "module", "function", "if", "else", "for", "intersection_for", "let", "each", "include", "use", "true", "false", "undef",
]);
const BUILTINS = new Set([
  "cube", "sphere", "cylinder", "polyhedron", "circle", "square", "polygon", "text", "import", "surface",
  "translate", "rotate", "scale", "resize", "mirror", "multmatrix", "color", "offset", "hull", "minkowski",
  "union", "difference", "intersection", "linear_extrude", "rotate_extrude", "projection", "render", "children",
  "echo", "assert", "len", "concat", "lookup", "str", "chr", "ord", "search", "version", "rands",
  "abs", "sign", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "floor", "ceil", "round",
  "sqrt", "pow", "exp", "ln", "log", "min", "max", "norm", "cross",
]);

interface State {
  inBlockComment: boolean;
}

/** A small OpenSCAD tokenizer: enough for highlighting, not a parser. */
const openscad = StreamLanguage.define<State>({
  startState: () => ({ inBlockComment: false }),
  token(stream, state) {
    if (state.inBlockComment) {
      while (!stream.eol()) {
        if (stream.match("*/")) {
          state.inBlockComment = false;
          break;
        }
        stream.next();
      }
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.inBlockComment = true;
      return "comment";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^\$[A-Za-z_]\w*/)) return "variableName.special";
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const w = stream.current();
      if (KEYWORDS.has(w)) return "keyword";
      if (BUILTINS.has(w)) return "typeName";
      return null;
    }
    if (stream.match(/^[-+*/%^<>=!&|?:]+/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
});

// Colours come from CSS variables, so the editor follows the app's light/dark theme.
const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--tok-kw)" },
  { tag: t.typeName, color: "var(--tok-fn)" },
  { tag: t.number, color: "var(--tok-num)" },
  { tag: t.special(t.variableName), color: "var(--tok-var)" },
  { tag: t.string, color: "var(--tok-str)" },
  { tag: t.comment, color: "var(--tok-com)", fontStyle: "italic" },
  { tag: t.operator, color: "var(--muted)" },
]);

export const openscadLanguage = [openscad, syntaxHighlighting(highlight)];
