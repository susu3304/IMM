import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const wasm = await import("../src/wasm/pkg/imm_wasm.js");
const bytes = await readFile(new URL("../src/wasm/pkg/imm_wasm_bg.wasm", import.meta.url));

wasm.initSync({ module: bytes });

const hello = await wasm.run(
  `marmot main {
    squeak "Hello from IMM WASM"
}
`,
  false,
  ""
) as { ok: boolean; stdout: string; stderr: string };

assert.equal(hello.ok, true, hello.stderr || hello.stdout);
assert.match(hello.stdout, /Hello from IMM WASM/);

const stdin = await wasm.run(
  `marmot main {
    let name = sniff
    let move = sniff
    squeak name + ":" + move
}
`,
  false,
  "susu\nUP\n"
) as { ok: boolean; stdout: string; stderr: string };

assert.equal(stdin.ok, true, stdin.stderr || stdin.stdout);
assert.match(stdin.stdout, /susu:UP/);

const server = createServer((req, res) => {
  assert.equal(req.url, "/data");
  res.writeHead(200, {
    "content-type": "application/json",
    "x-imm-test": "wasm"
  });
  res.end(JSON.stringify({ name: "browser-host" }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const web = await wasm.run(
    `use web
use tick

howl marmot main {
    let res = wait web.fetch("http://127.0.0.1:${address.port}/data")
    squeak res.status
    squeak res.headers["x-imm-test"]
    squeak res.json()["name"]
    wait nap(1)
    squeak tick.now() > 0
}
`,
    false,
    ""
  ) as { ok: boolean; stdout: string; stderr: string };

  assert.equal(web.ok, true, web.stderr || web.stdout);
  assert.match(web.stdout, /200\nwasm\nbrowser-host\ntrue/);
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

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
