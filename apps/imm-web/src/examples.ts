export interface ImmExample {
  name: string;
  source: string;
  stdin?: string;
}

export const examples: ImmExample[] = [
  {
    name: "Hello",
    source: `marmot main {
    squeak "Hello, IMM from the browser!"
}
`
  },
  {
    name: "Input",
    stdin: "susu\n",
    source: `marmot main {
    let name = sniff
    squeak "Hello, " + name
}
`
  },
  {
    name: "Matrix",
    source: `marmot main {
    let field = matrix [
        [1, 2, 3],
        [4, 5, 6]
    ]
    squeak "width=" + str(field.width())
    squeak "height=" + str(field.height())
    squeak "center=" + str(field[1, 1])
}
`
  },
  {
    name: "Loop",
    source: `marmot main {
    let total = 0
    for n in 0..6 {
        total = total + n
    }
    squeak "sum=" + str(total)
}
`
  },
  {
    name: "Sandbox",
    source: `use web

marmot main {
    let res = web.grab("data:application/json,%7B%22name%22%3A%22marmot%22%7D")
    squeak res.status
    squeak res.json()["name"]
}
`
  }
];
