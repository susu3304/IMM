export type LanguageDocCoverage = "browser" | "native" | "partial";

export interface LanguageDocSection {
  id: string;
  category: string;
  title: string;
  summary: string;
  coverage: LanguageDocCoverage;
  coverageNote: string;
  keywords: string[];
  bullets: string[];
  syntax?: string[];
  code?: string;
}

export const languageDocCategories = [
  "All",
  "Basics",
  "Values",
  "Flow",
  "Objects",
  "Tasks",
  "Libraries",
  "Tooling",
  "Runtime"
];

export const languageDocs: LanguageDocSection[] = [
  {
    id: "program-structure",
    category: "Basics",
    title: "プログラム構造とエントリーポイント",
    summary: ".imm ファイルは UTF-8 ソースとして読み込まれ、トップレベルの宣言と main ブロックから実行されます。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["marmot", "main", "howl", "insane", ".imm"],
    bullets: [
      "`marmot main { ... }` が通常のエントリーポイントです。",
      "`howl marmot main { ... }` はタスクランタイム上で実行され、`wait` / `scatter` / `nest` を使えます。",
      "`insane marmot main` と `insane howl marmot main` は unsafe/relaxed な実行属性を持つ入口として受理されます。",
      "トップレベルには `dig`、`howl dig`、`den`、`mask`、`use`、`probe`、`pack`、モジュール宣言を置けます。"
    ],
    syntax: ["marmot main", "howl marmot main", "insane marmot main"],
    code: `marmot main {
    squeak "Hello, insane marmot matrix!"
}

howl marmot main {
    wait nap(10)
    squeak "task runtime ready"
}`
  },
  {
    id: "lexical-rules",
    category: "Basics",
    title: "字句、コメント、文の区切り",
    summary: "文は改行またはセミコロンで区切れます。コメントは実行前に無視され、CRLF は正規化されます。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["comment", "semicolon", "newline", "UTF-8", "CRLF"],
    bullets: [
      "行コメントは `# ...`、ブロックコメントは `/* ... */` です。",
      "文字列は `\"`、`\\\\`、`\\n`、`\\t` のエスケープに対応します。",
      "識別子は英字または `_` から始まり、英数字と `_` を続けられます。",
      "改行区切りが基本ですが、短い文は `;` でも区切れます。"
    ],
    syntax: ["# comment", "/* block comment */", ";"],
    code: `marmot main {
    # one-line comment
    let name = "marmot\\n"
    squeak name; squeak "done"
}`
  },
  {
    id: "values-and-types",
    category: "Values",
    title: "値と型注釈",
    summary: "実行時の値は動的ですが、型注釈を付けた場所では実行時検査と check の静的検査が入ります。",
    coverage: "partial",
    coverageNote: "runtime checks done / static checks growing",
    keywords: ["Any", "Int", "Float", "Bool", "String", "Array", "Matrix", "Point", "Null", "Map", "Void", "Task", "Response"],
    bullets: [
      "基本型は `Int`、`Float`、`Bool`、`String`、`Null` です。",
      "複合型は `Array<T>`、`Matrix<T>`、`Map<T>`、`Point`、`den` 型、`mask` 型を扱えます。",
      "`Void` は値を返さない関数や mask シグネチャに使います。",
      "`Any` は任意の値を許す注釈です。",
      "`Task`、`TaskGroup`、`Response`、`WebApp`、`Server` などの runtime 型も注釈に使えます。",
      "`Array<T>`、`Matrix<T>`、`Map<T>` は再帰的に型検査されます。"
    ],
    syntax: ["let x: Int", "dig f() -> String", "let p: Point"],
    code: `marmot main {
    let turn: Int = 10
    let name: String = "marmot"
    let flags: Array<Bool> = [true, false]
    let p: Point = @point(2, 1)

    squeak type(turn)
    squeak str(p)
}`
  },
  {
    id: "variables-scope-assignment",
    category: "Values",
    title: "変数、定数、スコープ",
    summary: "`let` は再代入できる変数、`stash` は定数です。ブロック、関数、ループはレキシカルスコープを作ります。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["let", "stash", "scope", "assignment", "shadowing"],
    bullets: [
      "`let name = expr` は後から `name = next` で更新できます。",
      "`stash NAME = expr` は再代入できず、設定値や上限値に向きます。",
      "内側のブロックでは外側の名前を参照でき、同名のローカル変数でシャドーイングできます。",
      "配列、Matrix、Map、オブジェクトのメンバーやインデックスにも代入できます。"
    ],
    syntax: ["let", "stash", "target = expr"],
    code: `stash MAX_TURN = 100

marmot main {
    let score = 0
    score = score + 10

    if score < MAX_TURN {
        let message = "keep going"
        squeak message
    }
}`
  },
  {
    id: "operators-expressions",
    category: "Values",
    title: "式、演算子、変換",
    summary: "算術、比較、論理、単項演算、文字列結合、範囲、関数呼び出し、メンバーアクセスを式として組み合わせます。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["operator", "range", "conversion", "member", "call"],
    bullets: [
      "`+ - * / %`、`== != < <= > >=`、`&& || !` を使えます。",
      "`+` は数値加算だけでなく文字列結合にも使えます。",
      "`Int / Int` は `Float` を返します。整数の剰余は `%` を使います。",
      "`0..5` は half-open range で、`for` に渡すと 0 から 4 までを走査します。",
      "`str`、`int`、`float`、`bool`、`type` で基本的な変換と型名取得を行います。"
    ],
    syntax: ["a + b", "0..5", "value.member", "f(args...)"],
    code: `marmot main {
    let hp = 80
    let label = "hp=" + str(hp)

    squeak hp >= 50 && hp < 100
    squeak label
    squeak float("12.5") + 0.5
}`
  },
  {
    id: "arrays-maps-indexing",
    category: "Values",
    title: "配列、Map、インデックス",
    summary: "配列は順序付きコレクション、Map は文字列キー中心の構造値として使います。インデックス読み書きは式です。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["Array", "Map", "index", "json", "literal"],
    bullets: [
      "配列は `[1, 2, 3]`、Map は `{ \"key\": value }` で作れます。",
      "Map literal のキーは `String` である必要があります。",
      "配列と文字列の範囲外読み取りは safe mode ではエラー、insane mode では `null` になります。",
      "Map は `value[\"key\"]` で読み書きできます。",
      "JSON レスポンスや web handler では Map が主要な受け渡し形式になります。"
    ],
    syntax: ["[a, b, c]", "{\"name\": value}", "target[index]"],
    code: `marmot main {
    let route = ["UP", "RIGHT", "DOWN"]
    let player = {
        "name": "susu",
        "hp": 100
    }

    route[1] = "LEFT"
    player["hp"] = player["hp"] - 20

    squeak route
    squeak player["name"] + ": " + str(player["hp"])
}`
  },
  {
    id: "matrix-point",
    category: "Values",
    title: "Matrix と Point",
    summary: "IMM の中心機能です。盤面は `matrix`、座標は `@point(x, y)` で表し、Matrix は座標または y/x でアクセスします。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["matrix", "Point", "@point", "neighbors4", "neighbors8", "find"],
    bullets: [
      "`matrix [ ... ]` は全行の長さが一致している必要があります。",
      "セルアクセスは `field[y, x]` または `field[p]` です。",
      "`Point` は `.x` と `.y` を持ち、等価比較と加算に対応します。",
      "Matrix メソッドは `width()`、`height()`、`in_bounds(p)`、`points()`、`neighbors4(p)`、`neighbors8(p)`、`find(v)`、`find_all(v)` です。"
    ],
    syntax: ["matrix [[...]]", "@point(x, y)", "field[y, x]", "field[p]"],
    code: `marmot main {
    let field = matrix [
        ["S", ".", "."],
        ["#", "#", "."],
        [".", ".", "G"]
    ]

    let start = field.find("S")
    let next = start + @point(1, 0)

    squeak field.width()
    squeak field.neighbors4(next)
}`
  },
  {
    id: "control-flow",
    category: "Flow",
    title: "制御構文",
    summary: "条件分岐、範囲 for、while、break、continue を備えます。条件式は Bool でなければなりません。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["if", "else", "for", "while", "break", "continue", "range"],
    bullets: [
      "`if` / `else if` / `else` はブロックを実行します。",
      "`for name in 0..n` は half-open range を順に走査します。",
      "`for item in array` は配列要素、`for char in string` は1文字ずつ、`for pair in map` は `[key, value]` を走査します。",
      "`while` は条件が `true` の間だけ繰り返し、`break` と `continue` で制御できます。"
    ],
    syntax: ["if condition { ... }", "for x in iterable { ... }", "while condition { ... }"],
    code: `marmot main {
    let total = 0

    for n in 0..6 {
        if n == 3 {
            continue
        }
        total = total + n
    }

    while total < 20 {
        total = total + 2
    }

    squeak total
}`
  },
  {
    id: "functions-lambdas-tunnel",
    category: "Flow",
    title: "関数、ラムダ、tunnel",
    summary: "`dig` は関数定義、ラムダは高階関数に渡す短い処理、`tunnel` は左辺の値を右辺の関数へ流すパイプ構文です。",
    coverage: "partial",
    coverageNote: "runtime done / lambda static typing planned",
    keywords: ["dig", "return", "lambda", "tunnel", "map", "filter", "reduce"],
    bullets: [
      "`dig name(args...) -> Type { ... }` で関数を定義します。戻り値がない場合は `-> Void` または省略を使います。",
      "ラムダは `x => expr`、複数引数やブロックラムダも扱えます。",
      "`return` は関数を終了し、指定した値を呼び出し元へ返します。",
      "`tunnel` は `map`、`filter`、`reduce` のような処理を読みやすく連結するために使います。"
    ],
    syntax: ["dig f(a: Int) -> Int", "x => x + 1", "value tunnel f(...)"],
    code: `dig double(x: Int) -> Int {
    return x * 2
}

marmot main {
    let result = [1, 2, 3, 4]
        tunnel filter(x => x % 2 == 0)
        tunnel map(x => double(x))
        tunnel reduce(0, (sum, x) => sum + x)

    squeak result
}`
  },
  {
    id: "io-diagnostics",
    category: "Flow",
    title: "I/O、trace、診断出力",
    summary: "`squeak` は標準出力、`trace` はデバッグ用 stderr、`sniff` は入力式です。Web Runner では stdin を閉じた単一ソース実行として扱います。",
    coverage: "partial",
    coverageNote: "squeak/traceはWASM runnerでも利用可能。sniffは現在空文字列を返す",
    keywords: ["squeak", "sniff", "trace", "stdout", "stderr", "stdin"],
    bullets: [
      "`squeak expr` は stdout に値を出力します。",
      "`trace expr` は trace 実行が有効なときだけ stderr に出力され、通常の stdout と分離されます。",
      "`sniff` は stdin から読むための式として予約されています。",
      "現在の runtime では `sniff` は空文字列を返します。公開 Web Runner も stdin を渡しません。",
      "ブラウザ実行は 3 秒タイムアウトで worker を止めます。local API runner はソース 64KB、stdout/stderr 各 64KB の上限を持ちます。"
    ],
    syntax: ["squeak expr", "trace expr", "sniff"],
    code: `marmot main {
    let input = sniff

    trace "input length=" + str(len(input))
    squeak "visible output"
}`
  },
  {
    id: "errors-insane",
    category: "Flow",
    title: "panic、try/catch、insane",
    summary: "通常のエラー処理は `panic` と `try/catch` です。`insane` は安全性を一部緩める構文属性として実装されています。",
    coverage: "partial",
    coverageNote: "core behavior done / more unsafe differences planned",
    keywords: ["panic", "try", "catch", "insane", "choose"],
    bullets: [
      "`panic expr` は runtime error を発生させます。",
      "`try { ... } catch err { ... }` は回復可能な runtime error を捕まえます。",
      "`insane try { ... }` は回復可能な runtime error を握りつぶします。",
      "`insane choose collection` はランダムに要素を選び、空なら `null` を返します。",
      "`insane` の中では配列、文字列、Matrix の範囲外読み取りが `null` になり、範囲外書き込みは無視されます。",
      "`insane for` は構文として受理され、現在は insane mode 内の通常ループとして実行されます。並列実行は計画段階です。"
    ],
    syntax: ["panic expr", "try { ... } catch err { ... }", "insane choose items"],
    code: `marmot main {
    let fallback = "safe"

    try {
        panic "boom"
    } catch err {
        fallback = "caught: " + str(err)
    }

    let move = insane choose ["UP", "DOWN", "LEFT", "RIGHT"]
    squeak fallback
    squeak move
}`
  },
  {
    id: "modules-use-burrow",
    category: "Basics",
    title: "モジュール、use、burrow",
    summary: "`use` は標準ライブラリやローカル .imm モジュールを読み込みます。循環読み込みは検出されます。",
    coverage: "partial",
    coverageNote: "module loading done / explicit exports planned",
    keywords: ["use", "burrow", "module", "namespace", "cycle"],
    bullets: [
      "`use web`、`use store` のように標準ライブラリ名前空間を使えます。",
      "ローカル `.imm` ファイルはキャッシュ付きで読み込まれます。",
      "モジュール循環は check/run で検出されます。",
      "ブラウザ WASM runner は単一ソース実行なので、ローカル `.imm` モジュールのファイル解決は native/API runtime 側の機能です。",
      "明示的な export/import ルールは今後の拡張対象です。"
    ],
    syntax: ["use web", "use path", "burrow"],
    code: `use path

marmot main {
    let field = matrix [
        ["S", "."],
        [".", "G"]
    ]
    squeak path.bfs(field, field.find("S"), field.find("G"), cell => cell != "#")
}`
  },
  {
    id: "object-model",
    category: "Objects",
    title: "den、mask、hatch",
    summary: "`den` はオブジェクト型、`mask` は公開メソッドの契約、`hatch` はインスタンス生成です。",
    coverage: "partial",
    coverageNote: "runtime object model done / deeper static analysis planned",
    keywords: ["den", "mask", "hatch", "self", "fur", "fang", "wear", "under"],
    bullets: [
      "`fur` は public、`fang` は private です。省略時は `fang` として扱われます。",
      "`init` はコンストラクタで、戻り型を宣言しません。",
      "`den Name wear MaskA, MaskB` は必要メソッドとシグネチャを検査します。",
      "`den Child under Parent` は単一継承です。`under.init(...)` と `under.method(...)` で親実装を呼びます。",
      "mask 型として注釈した値は、その mask に定義されたメソッドだけを公開します。"
    ],
    syntax: ["den Name { ... }", "mask Name { ... }", "hatch Name(args...)"],
    code: `mask Movable {
    dig move(dir: String) -> Void
}

den Player wear Movable {
    fur let name: String
    fang let hp: Int = 100

    fur dig init(name: String) {
        self.name = name
    }

    fur dig move(dir: String) {
        squeak self.name + " moves " + dir
    }
}

marmot main {
    let p: Movable = hatch Player("marmot")
    p.move("UP")
}`
  },
  {
    id: "howl-tasks",
    category: "Tasks",
    title: "howl タスク",
    summary: "`howl` は async entrypoint と async function を表します。native では tokio-backed runtime、WASM では制約付き runtime で評価されます。",
    coverage: "partial",
    coverageNote: "native async done / browser has no native handles",
    keywords: ["howl", "wait", "scatter", "nest", "nap", "Task"],
    bullets: [
      "`howl dig f(...) -> T` は呼び出し時に `Task<T>` を返します。",
      "`wait task` は `Task<T>` を `T`、`TaskGroup<T>` を `Array<T>` に変換します。",
      "`scatter expr` は処理を開始し、タスク値を返します。",
      "`nest { scatter ... }` は複数タスクをまとめ、wait 時に字句順の配列として返します。",
      "Task は `done()` と `cancel()` を持ちます。",
      "`nap(ms)` は native runtime の non-blocking sleep です。browser WASM runtime では利用できません。",
      "`wait`、`scatter`、`nest` は howl context の外では静的エラーです。"
    ],
    syntax: ["howl dig", "wait task", "scatter expr", "nest { ... }"],
    code: `howl dig load(name: String) -> String {
    wait nap(10)
    return "loaded " + name
}

howl marmot main {
    let a = scatter load("a")
    let b = scatter load("b")

    squeak wait a
    squeak wait b
}`
  },
  {
    id: "core-math-tick",
    category: "Libraries",
    title: "core、math、tick",
    summary: "`core` は自動読み込み、`math` と `tick` は名前空間として利用できます。",
    coverage: "partial",
    coverageNote: "core/mathはWASM runnerでも利用可能。nap と tick.now は native runtime",
    keywords: ["core", "math", "tick", "len", "type", "random", "now"],
    bullets: [
      "`core` は `len`、`type`、`str`、`int`、`float`、`bool`、`map`、`filter`、`reduce`、`nap` を提供します。",
      "`math` は `abs`、`min`、`max`、`sqrt`、`floor`、`ceil`、`random` を提供します。",
      "`tick.now()` は native runtime で UNIX milliseconds を返します。",
      "`nap(ms)` は native howl task として sleep します。browser WASM runtime ではエラーになります。",
      "`use math` は必須ではありません。`math.sqrt(...)` のように名前空間から参照できます。"
    ],
    syntax: ["len(value)", "math.sqrt(x)", "tick.now()"],
    code: `marmot main {
    let values = [3, 9, 12]
    squeak len(values)
    squeak math.max(values[0], values[2])
    squeak tick.now()
}`
  },
  {
    id: "path-chaser",
    category: "Libraries",
    title: "path と chaser",
    summary: "盤面探索と CHaser 風ボットの補助関数です。Matrix/Point と組み合わせることで最短経路や安全手を扱えます。",
    coverage: "browser",
    coverageNote: "WASM runner / native CLI",
    keywords: ["path", "bfs", "astar", "chaser", "safe_moves", "direction"],
    bullets: [
      "`path.bfs(field, start, goal, passable)` と `path.astar(...)` は経路を返します。",
      "`passable` はセル値を受け取り、通行可能なら `true` を返すラムダです。",
      "`chaser.direction`、`chaser.step`、`chaser.parse_field`、`chaser.safe_moves`、`chaser.random_move` を提供します。",
      "現在の `path.astar` は 4-neighbor の unweighted search として動き、重み付き heuristic は未導入です。",
      "現在の `chaser.random_move` は安全手の先頭を選びます。完全なランダム選択は今後の改善対象です。",
      "本格的な CHaser turn-loop runtime は計画段階です。"
    ],
    syntax: ["path.bfs(...)", "path.astar(...)", "chaser.safe_moves(...)"],
    code: `use path

marmot main {
    let field = matrix [
        ["S", ".", "."],
        ["#", "#", "."],
        [".", ".", "G"]
    ]

    let route = path.astar(field, field.find("S"), field.find("G"), cell => cell != "#")
    squeak route
}`
  },
  {
    id: "store-library",
    category: "Libraries",
    title: "store 永続化",
    summary: "`store` は外部DBなしで den オブジェクトを JSON-backed な .immstore ファイルへ保存する標準永続化機能です。",
    coverage: "native",
    coverageNote: "native CLI/API向け。browser WASMでは永続ファイルを持たない",
    keywords: ["store", "immstore", "save", "load", "find", "count"],
    bullets: [
      "`store.open(path)` はストアファイルを開くか作成します。",
      "`store.save(db, object)` は insert/update し、整数 id を返します。",
      "`store.load`、`store.all`、`store.find`、`store.get` は den 型を受け取り、現在の型定義に照らして復元します。",
      "`store.delete`、`store.count`、`store.clear` で削除や集計を行います。",
      "保存できるフィールド値は `null`、`Bool`、`Int`、`Float`、`String`、`Array`、`Point`、`Matrix`、`den` オブジェクトです。",
      "`Map`、関数、Task、Response、WebApp などは store に直列化できません。",
      "トランザクション、インデックス、並行 writer 保証は初期版の対象外です。"
    ],
    syntax: ["use store", "store.save(db, object)", "store.load(db, Type, id)"],
    code: `use store

den Player {
    fur let name: String
    fang let hp: Int = 100

    fur dig init(name: String) {
        self.name = name
    }
}

marmot main {
    let db = store.open("players.immstore")
    let p = hatch Player("susu")
    let id = store.save(db, p)

    let loaded: Player = store.load(db, Player, id)
    squeak loaded.name
}`
  },
  {
    id: "web-client",
    category: "Libraries",
    title: "web クライアント",
    summary: "`web.grab` は同期 HTTP、`web.fetch` は howl task として HTTP を扱います。Response は値として返ります。",
    coverage: "native",
    coverageNote: "data: URLはWASM runnerでも利用可能。外部HTTPはnative runtime",
    keywords: ["web", "grab", "fetch", "Response", "json", "headers"],
    bullets: [
      "`web.grab(url)` / `web.grab(options)` は `Response` を返します。",
      "`web.fetch(...)` は `Task<Response>` を返し、`howl` context で `wait` できます。",
      "options は `method`、`url`、`headers`、`body`、`timeout_ms` を持つ Map です。",
      "`Response` は `status`、`headers`、`body`、`url`、`ok`、`text()`、`json()` を公開します。",
      "browser WASM runtime では `data:` URL の `web.grab` をサポートし、外部 HTTP は native/API runtime 側の機能です。",
      "HTTP 4xx/5xx は Response として返り、ネットワーク失敗、timeout、不正 URL、不正 JSON は runtime error です。"
    ],
    syntax: ["web.grab(url)", "web.fetch(options)", "res.json()"],
    code: `use web

marmot main {
    let res = web.grab("data:application/json,%7B%22name%22%3A%22marmot%22%7D")

    squeak res.status
    squeak res.json()["name"]
}`
  },
  {
    id: "web-server",
    category: "Libraries",
    title: "web サーバー",
    summary: "`web.den` / `web.burrow` は IMM-native な HTTP サーバー API です。閉じた環境や API ランタイムでの利用を想定します。",
    coverage: "native",
    coverageNote: "native CLI/API only",
    keywords: ["web.den", "web.burrow", "release", "peek", "route", "middleware"],
    bullets: [
      "`den.sniff`、`den.stash`、`den.replace`、`den.patch`、`den.erase`、`den.ask`、`den.nod`、`den.any` で route を登録します。",
      "`den.wear` は middleware、`den.dig` は burrow mount、`den.hoard` は static directory、`den.lost` / `den.rescue` は 404/error handler です。",
      "Context は `ctx.req`、`ctx.paws` / `ctx.params`、`ctx.trail` / `ctx.query`、`ctx.pouch` / `ctx.state` を持ちます。",
      "`web.release` は停止まで serve し、`web.peek` / `web.listen` は test や embed 向けの server handle を返します。",
      "TLS、WebSocket、SSE は予約済みで未実装です。"
    ],
    syntax: ["web.den()", "den.sniff(path, handler)", "web.release(den, options)"],
    code: `use web

dig home(ctx) {
    return web.html("<h1>Hello IMM</h1>")
}

dig show_user(ctx) {
    return web.shiny({
        "id": ctx.paws["id"],
        "trail": ctx.trail
    })
}

marmot main {
    let den = web.den()
    den.wear(web.trace())
    den.sniff("/", home)
    den.sniff("/users/:id", show_user)

    web.release(den, {
        "host": "127.0.0.1",
        "port": 8080
    })
}`
  },
  {
    id: "probe-law-trace",
    category: "Tooling",
    title: "probe、law、trace",
    summary: "言語レベルのテストは `probe`、共有仕様テストは `law`、実行時の診断出力は `trace` です。",
    coverage: "partial",
    coverageNote: "probe/law native CLI。traceはWASM runnerでも利用可能",
    keywords: ["probe", "expect", "law", "trace", "test"],
    bullets: [
      "`probe \"name\" { expect expr }` は IMM ソース内に置けるテストブロックです。",
      "`expect expr` が `true` でなければ、その probe は失敗します。",
      "`imm probe` はデフォルトで `tests/imm/*.probe.imm` を発見します。",
      "`imm law` は `laws/` の共有 conformance suite を実行します。",
      "`trace expr` は `imm run --trace` または Web Runner の trace ON のときだけ stderr に出力されます。"
    ],
    syntax: ["probe \"name\" { ... }", "expect expr", "trace expr"],
    code: `probe "matrix find" {
    let field = matrix [
        ["S", "."],
        [".", "G"]
    ]

    expect field.find("G") == @point(1, 1)
}

marmot main {
    trace "debug only"
    squeak "normal output"
}`
  },
  {
    id: "cli-pack-format",
    category: "Tooling",
    title: "CLI、check、fmt、pack",
    summary: "インストール後のコマンド名は `imm` です。開発 crate では `imm-native` としても動きます。",
    coverage: "native",
    coverageNote: "native CLI",
    keywords: ["imm", "run", "check", "fmt", "pack", "spec", "pelt"],
    bullets: [
      "`imm run file.imm` は実行、`imm check file.imm` は実行せず解析と静的検査を行います。",
      "`imm fmt file.imm` はコメントと文字列を保ちながらインデント、改行、末尾空白を整えます。",
      "`imm spec --json` は機械可読な言語メタデータを出力します。",
      "`imm pack entry.imm --crate dist/app --pelt native` は evaluator と entry directory の .imm ソースを埋め込んだ Rust 実行 artifact を作ります。",
      "現在の pelt は `native` が実装済みです。Python pelt は Rust 移行で削除されました。"
    ],
    syntax: ["imm run", "imm check", "imm fmt", "imm pack", "imm spec --json"],
    code: `imm --version
imm check main.imm
imm run main.imm --trace
imm fmt main.imm
imm probe
imm law
imm spec --json
imm pack main.imm --crate dist/main-native --pelt native`
  },
  {
    id: "runtime-targets",
    category: "Runtime",
    title: "WASM、API、Native の実行境界",
    summary: "同じ imm-core を共有しながら、ブラウザ公開用、閉じた API 用、ローカル CLI 用で使える機能の境界を分けます。",
    coverage: "partial",
    coverageNote: "browser WASM done for core run/check。API runtime is next expansion point",
    keywords: ["WASM", "API", "native", "sandbox", "runtime"],
    bullets: [
      "browser WASM runner は `imm-core` を `default-features = false` でビルドし、ソースの `run` / `check` / `format` / `spec` をクライアント側で実行します。",
      "WASM runner は worker と 3 秒タイムアウトで隔離されます。OS sandbox、ファイル永続化、native TCP server、native HTTP client は持ちません。",
      "native CLI/API runtime は `native` feature を使い、HTTP client/server、store、pack、law suite を含みます。",
      "local API runner は 64KB のソース上限、3 秒標準タイムアウト、最大 8 秒タイムアウト、stdout/stderr 各 64KB 上限を持ちます。",
      "公開 imm-web はクライアント実行を標準にし、閉じた環境では API key 付き runtime API を接続する構成にできます。",
      "機能差は言語仕様ではなく runtime capability として扱い、同じソースを check した上で実行先の制約を表示する方針です。"
    ],
    syntax: ["browser-wasm", "native-cli", "runtime-api"],
    code: `# browser
npm run build:wasm

# native
cargo run -p imm-native -- run examples/hello.imm

# API runtime boundary
POST /api/run
Authorization: Bearer <runtime-api-key>`
  },
  {
    id: "reserved-words-status",
    category: "Runtime",
    title: "予約語と実装状況",
    summary: "現在の予約語と標準名前空間は `imm spec --json` からも取得できます。いくつかの領域は構文予約済みまたは一部実装です。",
    coverage: "partial",
    coverageNote: "metadata done / advanced tooling planned",
    keywords: ["keyword", "spec", "reserved", "planned", "partial"],
    bullets: [
      "主要予約語は `marmot`、`insane`、`dig`、`let`、`stash`、`return`、`if`、`else`、`for`、`while`、`matrix`、`use`、`squeak`、`sniff`、`panic`、`try`、`catch`、`tunnel`、`den`、`mask`、`howl`、`probe`、`law`、`trace` です。",
      "標準名前空間は `core`、`math`、`matrix`、`path`、`chaser`、`store`、`web`、`tick` です。",
      "静的型検査、object 初期化解析、module export、LSP、VM/bytecode は段階的に拡張する領域です。",
      "`web.ws`、`web.websocket`、`web.sse` は web API 名として予約済みですが未実装です。",
      "仕様の正本は runtime 実装、law suite、`imm spec --json` の組み合わせです。"
    ],
    syntax: ["imm spec --json", "laws/*.law.imm", "tests/imm/*.probe.imm"],
    code: `{
  "shortName": "IMM",
  "extension": ".imm",
  "commands": ["run", "check", "fmt", "probe", "law", "pack", "spec"],
  "entrypoints": [
    "marmot main",
    "insane marmot main",
    "howl marmot main",
    "insane howl marmot main"
  ]
}`
  }
];

export const repositoryRoles = [
  {
    title: "Runtime",
    text: "Rust lexer, parser, checker, runtime, CLI, examples, docs, and law suite."
  },
  {
    title: "Installers",
    text: "Builds MSI, Debian packages, macOS archives, release assets, and APT metadata."
  },
  {
    title: "Homebrew",
    text: "Tap formula updated from installer releases for macOS users."
  },
  {
    title: "VS Code",
    text: "Independent extension release lane for grammar, snippets, commands, and VSIX artifacts."
  },
  {
    title: "Site / Web Runner",
    text: "This app: documentation, direct downloads, runtime selection, and sandboxed browser execution."
  }
];
