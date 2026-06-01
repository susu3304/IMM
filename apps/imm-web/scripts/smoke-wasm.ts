import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wasm = await import("../src/wasm/pkg/imm_wasm.js");
const bytes = await readFile(new URL("../src/wasm/pkg/imm_wasm_bg.wasm", import.meta.url));

wasm.initSync({ module: bytes });

const hello = wasm.run(
  `marmot main {
    squeak "Hello from IMM WASM"
}
`,
  false
) as { ok: boolean; stdout: string; stderr: string };

assert.equal(hello.ok, true, hello.stderr || hello.stdout);
assert.match(hello.stdout, /Hello from IMM WASM/);

const checked = wasm.check(`marmot main {
    squeak "check"
}
`) as { ok: boolean; stdout: string; stderr: string };

assert.equal(checked.ok, true, checked.stderr || checked.stdout);
assert.match(checked.stdout, /OK/);

const formatted = wasm.formatSource(`marmot main {
squeak "format"
}
`);
assert.equal(
  formatted,
  `marmot main {
    squeak "format"
}
`
);

assert.match(wasm.specJson(), /"shortName": "IMM"/);
console.log("wasm: ok");
