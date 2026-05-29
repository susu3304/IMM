export const docsSections = [
  {
    title: "Basics",
    text: "IMM source files use .imm. The entrypoint is marmot main. squeak writes output, sniff reads input, dig defines functions, let defines mutable values, and stash defines constants.",
    code: `marmot main {
    squeak "Hello, insane marmot matrix!"
}`
  },
  {
    title: "Matrix And Point",
    text: "matrix literals are rectangular. Access cells with [y, x] or [point]. Matrix helpers are methods on the matrix value.",
    code: `marmot main {
    let field = matrix [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0]
    ]
    let p = @point(2, 1)
    squeak field[p]
    squeak field.width()
    squeak field.neighbors4(p)
}`
  },
  {
    title: "Control Flow",
    text: "IMM has if / else, for ranges, while loops, break, continue, try / catch, and insane try.",
    code: `marmot main {
    let total = 0
    for n in 0..6 {
        total = total + n
    }
    if total > 10 {
        squeak "large"
    }
}`
  },
  {
    title: "Howl Tasks",
    text: "howl marks async entrypoints and functions. scatter starts work, wait unwraps a task, and nest gathers multiple tasks in lexical order.",
    code: `howl dig load() -> String {
    wait nap(10)
    return "ok"
}

howl marmot main {
    let task = scatter load()
    squeak wait task
}`
  },
  {
    title: "Web Standard Library",
    text: "use web exposes web.grab for synchronous responses and web.fetch for howl tasks. Response values expose status, headers, body, url, ok, text(), and json().",
    code: `use web

marmot main {
    let res = web.grab("data:application/json,%7B%22name%22%3A%22marmot%22%7D")
    squeak res.status
    squeak res.json()["name"]
}`
  },
  {
    title: "CLI Commands",
    text: "The installed command is imm. The development binary in the runtime repository is imm-native.",
    code: `imm --version
imm check main.imm
imm run main.imm
imm run main.imm --trace
imm fmt main.imm
imm probe
imm law
imm pack main.imm --pelt native`
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

