import { Program, runProgramWin, WinAllocationType, WinFreeType, WinProtect } from "../src/program";
import { run, test, assertEqual, assertLength, TestContext, assertTrue } from "./framework";

test("memset", t => {
  const p: Program = {
    instrs: [
      {
        winCall: {
          type: "VirtualAlloc",
          lpAddress: 16,
          dwSize: 32,
          flAllocationType: WinAllocationType.MEM_RESERVE | WinAllocationType.MEM_COMMIT,
          flProtect: WinProtect.PAGE_READWRITE,
        },
      },
      {
        winCall: {
          type: "memset",
          base: 16,
          length: 32,
          value: 3,
        },
      },
      {
        winCall: {
          type: "VirtualFree",
          lpAddress: 16,
          dwSize: 32,
          dwFreeType: WinFreeType.MEM_RELEASE,
        }
      },
    ],
  };

  runProgramWin(p);
});

run();
