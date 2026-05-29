import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const keywords = new Set([
  "marmot",
  "insane",
  "dig",
  "return",
  "let",
  "stash",
  "if",
  "else",
  "for",
  "in",
  "while",
  "break",
  "continue",
  "try",
  "catch",
  "use",
  "den",
  "hatch",
  "self",
  "fur",
  "fang",
  "mask",
  "wear",
  "under",
  "howl",
  "wait",
  "scatter",
  "nest",
  "probe",
  "expect",
  "true",
  "false",
  "null"
]);

const types = new Set(["Int", "Float", "Bool", "String", "Array", "Matrix", "Point", "Void", "Map", "Null"]);
const builtins = new Set(["squeak", "sniff", "panic", "matrix", "width", "height", "neighbors4", "neighbors8"]);

export const immLanguage = StreamLanguage.define({
  name: "imm",
  token(stream) {
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) {
      return "string";
    }
    if (stream.match(/-?\d+(?:\.\d+)?/)) {
      return "number";
    }
    if (stream.match(/@?[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current().replace(/^@/, "");
      if (keywords.has(word)) {
        return "keyword";
      }
      if (types.has(word)) {
        return "typeName";
      }
      if (builtins.has(word)) {
        return "builtin";
      }
      return "variableName";
    }
    if (stream.match(/[{}()[\],.:]/)) {
      return "punctuation";
    }
    if (stream.match(/[+\-*/%=<>!|&]+/)) {
      return "operator";
    }
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "//" }
  }
});

export const immHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "#9c3d14", fontWeight: "700" },
    { tag: tags.typeName, color: "#1d6f64", fontWeight: "700" },
    { tag: tags.string, color: "#166534" },
    { tag: tags.number, color: "#7c3aed" },
    { tag: tags.comment, color: "#7b8190", fontStyle: "italic" },
    { tag: tags.operator, color: "#9f1239" },
    { tag: tags.punctuation, color: "#5b6472" },
    { tag: tags.standard(tags.name), color: "#b45309", fontWeight: "700" },
    { tag: tags.variableName, color: "#233142" }
  ])
);
