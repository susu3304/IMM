import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { languageDocCategories, languageDocs, type LanguageDocSection } from "../src/siteContent.js";

interface ImmSpec {
  commands: string[];
  entrypoints: string[];
  keywords: string[];
  libraries: string[];
  objectModel: string[];
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

const requiredCapabilityTerms = [
  "sniff",
  "stdin",
  "web.grab",
  "web.fetch",
  "Browser WASM",
  "runtime API",
  "tick.now",
  "nap",
  "CORS"
];

const categoryExpectations = [
  { category: "Flow", terms: ["sniff", "stdin"] },
  { category: "Objects", terms: ["den", "mask", "hatch"] },
  { category: "Libraries", terms: ["web.grab", "web.fetch", "tick.now", "nap", "CORS"] },
  { category: "Tooling", terms: ["imm run", "imm check", "imm fmt", "imm spec --json"] },
  { category: "Runtime", terms: ["Browser WASM", "runtime API"] }
];

const failures: string[] = [];

const spec = loadSpec();
const allDocsText = normalize(languageDocs.map(sectionText).join("\n"));

checkCategories();
checkSpecCoverage(spec);
checkRequiredTerms();
checkCategoryExpectations();

if (failures.length) {
  for (const failure of failures) {
    console.error(`docs: ${failure}`);
  }
  process.exit(1);
}

console.log("docs: ok");

function loadSpec(): ImmSpec {
  const result = spawnSync("cargo", ["run", "--quiet", "-p", "imm-native", "--", "spec", "--json"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `cargo spec exited with ${result.status}`);
  }
  const parsed = JSON.parse(result.stdout) as Partial<ImmSpec>;
  for (const field of ["commands", "entrypoints", "keywords", "libraries", "objectModel"] as const) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`spec is missing ${field}`);
    }
  }
  return parsed as ImmSpec;
}

function checkCategories() {
  if (languageDocCategories[0] !== "All") {
    failures.push("languageDocCategories must start with All");
  }

  const declared = new Set(languageDocCategories);
  const contentCategories = new Set<string>();
  const seenIds = new Set<string>();

  for (const section of languageDocs) {
    if (seenIds.has(section.id)) {
      failures.push(`duplicate languageDocs id: ${section.id}`);
    }
    seenIds.add(section.id);

    if (!declared.has(section.category)) {
      failures.push(`${section.id} uses undeclared category ${section.category}`);
    }
    contentCategories.add(section.category);
  }

  for (const category of languageDocCategories.filter((category) => category !== "All")) {
    if (!contentCategories.has(category)) {
      failures.push(`declared category has no docs: ${category}`);
    }
  }
}

function checkSpecCoverage(spec: ImmSpec) {
  checkTerms("commands", spec.commands.map((command) => `imm ${command}`));
  checkTerms("entrypoints", spec.entrypoints);
  checkTerms("keywords", spec.keywords);
  checkTerms("libraries", spec.libraries);
  checkTerms("objectModel", spec.objectModel);
}

function checkRequiredTerms() {
  checkTerms("required capability", requiredCapabilityTerms);
}

function checkCategoryExpectations() {
  for (const expectation of categoryExpectations) {
    const categoryText = normalize(
      languageDocs
        .filter((section) => section.category === expectation.category)
        .map(sectionText)
        .join("\n")
    );
    for (const term of expectation.terms) {
      if (!containsTerm(categoryText, term)) {
        failures.push(`${expectation.category} docs missing ${term}`);
      }
    }
  }
}

function checkTerms(label: string, terms: string[]) {
  for (const term of terms) {
    if (!containsTerm(allDocsText, term)) {
      failures.push(`${label} missing ${term}`);
    }
  }
}

function sectionText(section: LanguageDocSection): string {
  return [
    section.id,
    section.category,
    section.title,
    section.summary,
    section.coverage,
    section.coverageNote,
    ...section.keywords,
    ...section.bullets,
    ...(section.syntax ?? []),
    section.code ?? ""
  ].join("\n");
}

function containsTerm(text: string, term: string): boolean {
  return text.includes(normalize(term));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
