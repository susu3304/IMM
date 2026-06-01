import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { executeImm } from "../server/sandbox.js";
import { getEngineInfo } from "../server/immBinary.js";

const engine = await getEngineInfo();
console.log(`engine: ${engine.version}`);

const hello = await executeImm({
  mode: "run",
  source: `marmot main {
    squeak "Hello from IMM Web Runner"
}
`
});

assert.equal(hello.ok, true, hello.stderr || hello.stdout);
assert.match(hello.stdout, /Hello from IMM Web Runner/);
assert.equal(hello.sandbox.tempDirIsolated, true);
console.log(`hello: ok (${hello.sandbox.kind}, ${hello.durationMs}ms)`);

const stdin = await executeImm({
  mode: "run",
  stdin: "susu\n",
  source: `marmot main {
    let name = sniff
    squeak "stdin=" + name
}
`
});

assert.equal(stdin.ok, true, stdin.stderr || stdin.stdout);
assert.match(stdin.stdout, /stdin=susu/);
console.log("stdin: ok");

if (hello.sandbox.osSandbox) {
  const escapePath = path.join(process.cwd(), "sandbox-escape.immstore");
  const escape = await executeImm({
    mode: "run",
    source: `use store

den Item {
    fur let name: String
    fur dig init(name: String) {
        self.name = name
    }
}

marmot main {
    let db = store.open(${JSON.stringify(escapePath)})
    let item = hatch Item("x")
    store.save(db, item)
    squeak "saved"
}
`
  });

  assert.equal(escape.ok, false, "home-directory write unexpectedly succeeded");
  await assert.rejects(access(escapePath));
  console.log("home write deny: ok");
}

const timeout = await executeImm({
  mode: "run",
  timeoutMs: 300,
  source: `marmot main {
    while true {
    }
}
`
});

assert.equal(timeout.ok, false);
assert.equal(timeout.timedOut, true);
console.log("timeout: ok");
