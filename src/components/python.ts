import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const KEYWORDS = new Set([
  "and", "as", "assert", "break", "class", "continue", "def", "del", "elif", "else", "except", "exec", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "not", "or", "pass", "print", "raise", "return", "try", "while", "with", "yield",
  "True", "False", "None",
]);
const BUILTINS = new Set([
  "abs", "all", "any", "bool", "dict", "enumerate", "float", "int", "len", "list", "map", "max", "min", "range", "reversed",
  "round", "set", "sorted", "str", "sum", "tuple", "zip", "math", "rs", "Rhino", "System", "scriptcontext",
]);

interface State {
  /** Inside a triple-quoted string: the quote that closes it. */
  triple: string | null;
}

/** A small Python tokenizer (RhinoScript): enough for highlighting, not a parser. */
const python = StreamLanguage.define<State>({
  startState: () => ({ triple: null }),
  token(stream, state) {
    if (state.triple) {
      while (!stream.eol()) {
        if (stream.match(state.triple)) {
          state.triple = null;
          break;
        }
        stream.next();
      }
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    const triple = stream.match(/^[rRuUbB]?("""|''')/) as RegExpMatchArray | null;
    if (triple) {
      state.triple = triple[1];
      while (!stream.eol()) {
        if (stream.match(state.triple)) {
          state.triple = null;
          break;
        }
        stream.next();
      }
      return "string";
    }
    if (stream.match(/^[rRuUbB]?"(?:[^"\\]|\\.)*"?/) || stream.match(/^[rRuUbB]?'(?:[^'\\]|\\.)*'?/)) return "string";
    if (stream.match(/^(?:0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/)) return "number";
    if (stream.match(/^@[A-Za-z_]\w*/)) return "variableName.special";
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const w = stream.current();
      if (KEYWORDS.has(w)) return "keyword";
      if (BUILTINS.has(w)) return "typeName";
      return null;
    }
    if (stream.match(/^[-+*/%<>=!&|^~]+/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "#" }, closeBrackets: { brackets: ["(", "[", "{", '"', "'"] }, indentOnInput: /^\s*(?:else|elif|except|finally):$/ },
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

export const pythonLanguage = [python, syntaxHighlighting(highlight)];
