// A custom test framework because I hate test frameworks!

interface TestCase {
  name: string;
  func: TestFunc;
  success: boolean;
  logs: Log[];

  children: TestCase[];
}

interface NormalLog {
  isError: false;
  stuff: any[];
}

interface ErrorLog {
  isError: true;
  err: Error;
}

type Log = NormalLog | ErrorLog;

export class TestContext {
  testCase: TestCase;

  constructor(testCase: TestCase) {
    this.testCase = testCase;
  }

  fail(message?: string) {
    this.testCase.success = false;
    if (message) {
      this.testCase.logs.push({
        err: new Error(message),
        isError: true,
      });
    }
  }

  test(name: string, func: TestFunc) {
    this.testCase.children.push({
      name: name,
      func: func,
      success: true,
      logs: [],
      children: [],
    });
  }

  log(...args: any[]) {
    this.testCase.logs.push({
      isError: false,
      stuff: args,
    });
  }
}

type TestFunc = (t: TestContext) => void;

const tests: TestCase[] = [];

export function test(name: string, func: TestFunc) {
  tests.push({
    name: name,
    func: func,
    success: true,
    logs: [],
    children: [],
  });
}

function runTests(tests: TestCase[], name?: string): boolean {
  let success = true;
  for (const test of tests) {
    const t = new TestContext(test);

    const oldConsole = console;
    console = {
      ...oldConsole,
      log(...args) {
        t.log(...args);
      },
      error(...args) {
        t.log(...args);
        t.fail();
      },
    };

    try {
      test.func(t);
    } catch (e) {
      test.logs.push({
        err: e instanceof Error ? e : new Error(JSON.stringify(e)),
        isError: true,
      });
      test.success = false;
    }

    console = oldConsole;
  
    runTests(test.children, name);

    if (!test.success) {
      success = false;
    }
  }
  return success;
}

export function run(name?: string) {
  const success = runTests(tests, name);
  
  function printTest(test: TestCase) {
    const emoji = test.success ? "✅" : "❌";
    if (!name || test.name === name) {
      console.groupCollapsed(`${emoji} ${test.name}`);
      for (const log of test.logs) {
        if (log.isError) {
          console.error(log.err);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          console.log(...log.stuff);
        }
      }
      console.groupEnd();
    }

    for (const child of test.children) {
      console.group();
      printTest(child);
      console.groupEnd();
    }
  }

  for (const test of tests) {
    printTest(test);
  }

  process.exit(success ? 0 : 1);
}
