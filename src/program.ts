// Types for the user program

export interface Memset {
    type: "memset";
    base: number;
    value: number;
    length: number;
}

export interface WinReservation {
    base: number;
    length: number;
}

export enum WinPageState {
    Free = "free",
    Reserved = "reserved",
    Committed = "committed",
}

export enum WinAllocationType {
    MEM_COMMIT = 0x00001000,
    MEM_RESERVE = 0x00002000,
    MEM_RESET = 0x00080000,
    MEM_RESET_UNDO = 0x1000000,
}

export enum WinProtect {
    PAGE_EXECUTE = 0x10,
    PAGE_EXECUTE_READ = 0x20,
    PAGE_EXECUTE_READWRITE = 0x40,
    PAGE_EXECUTE_WRITECOPY = 0x80,
    PAGE_NOACCESS = 0x01,
    PAGE_READONLY = 0x02,
    PAGE_READWRITE = 0x04,
    PAGE_WRITECOPY = 0x08,

    PAGE_GUARD = 0x100,
    PAGE_NOCACHE = 0x200,
    PAGE_WRITECOMBINE = 0x400,
}

export enum WinFreeType {
    MEM_DECOMMIT = 0x00004000,
    MEM_RELEASE = 0x00008000,

    // Modifiers for MEM_RELEASE when placeholders are used
    MEM_COALESCE_PLACEHOLDERS = 0x00000001,
    MEM_PRESERVE_PLACEHOLDER = 0x00000002,
}

/**
 * Calls that are available on all platforms. Note that these might not
 * _behave_ the same on all platforms, but at least they exist everywhere.
 */
export type CommonCall = Memset;

export interface WinVirtualAlloc {
    type: "VirtualAlloc";
    lpAddress: number;
    dwSize: number;
    flAllocationType: WinAllocationType;
    flProtect: WinProtect;
}

export interface WinVirtualFree {
    type: "VirtualFree";
    lpAddress: number;
    dwSize: number;
    dwFreeType: WinFreeType;
}

export type WinCall = CommonCall | WinVirtualAlloc | WinVirtualFree;

export interface WinPage {
    state: WinPageState;
    protection: WinProtect;
}

const defaultWinPage: WinPage = {
    state: WinPageState.Free,
    protection: WinProtect.PAGE_NOACCESS,
};

export class WinMemory {
    mem: number[];
    pageSize: number;
    reservations: WinReservation[];
    pages: Map<number, WinPage>; // indexed by base address

    constructor(numPages: number) {
        const pageSize = 4096; // hardcoded for now
        this.mem = Array<number>(pageSize * numPages).fill(0),
        this.pageSize = pageSize;
        this.reservations = [];
        this.pages = new Map();
    }

    pageForAddr(addr: number): WinPage {
        const pageBase = Math.floor(addr / this.pageSize) * this.pageSize;
        return this.pages.get(pageBase) ?? defaultWinPage;
    }

    write(addr: number, value: number) {
        const page = this.pageForAddr(addr);
        if (page.state !== WinPageState.Committed) {
            throw new Error(`SEGFAULT: page for address ${addr} was not committed`);
        }

        const writableProtections = [WinProtect.PAGE_READWRITE, WinProtect.PAGE_EXECUTE_READWRITE]; // TODO: copy-on-write stuff
        if (!writableProtections.includes(page.protection)) {
            throw new Error(`SEGFAULT: page for address ${addr} is not writable`);
        }

        this.mem[addr] = value;
    }
}

export interface Instruction {
    winCall?: WinCall;
    // TODO: Mac and Linux calls.
}

export interface Program {
    instrs: Instruction[];
}

function assertUnreachable(_: never): never {
    throw new Error("This was supposed to be unreachable >:(");
}

export function runProgramWin(p: Program) {
    const m = new WinMemory(16);

    for (const inst of p.instrs) {
        const call = inst.winCall;
        if (!call) {
            throw new Error("instruction doesn't work on Windows");
        }

        switch (call.type) {
            case "VirtualAlloc": {
                console.log("u haz");
            } break;
            case "VirtualFree": {
                console.log("freedom!!");
            } break;
            case "memset": {
                for (let i = 0; i < call.length; i++) {
                    m.write(call.base + i, call.value % 256);
                }
            } break;
            default: {
                assertUnreachable(call);
            }
        }
    }
}
