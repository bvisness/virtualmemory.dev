// Types for the user program

const KiB = 1024;

function assertUnreachable(_: never): never {
    throw new Error("This was supposed to be unreachable >:(");
}

function roundDownTo(n: number, to: number) {
    return Math.floor(n / to) * to;
}

function roundUpTo(n: number, to: number) {
    return Math.ceil(n / to) * to;
}

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
    baseAddr: number;
    state: WinPageState;
    protection: WinProtect;
}

const defaultWinPage = {
    state: WinPageState.Free,
    protection: WinProtect.PAGE_NOACCESS,
};

export class WinMemory {
    mem: number[];
    pageSize: number;
    allocationGranularity: number;
    reservations: WinReservation[];
    pages: Map<number, WinPage>; // indexed by base address

    constructor(numPages: number) {
        const pageSize = 4 * KiB; // hardcoded for now
        this.mem = Array<number>(pageSize * numPages).fill(0),
        this.pageSize = pageSize;
        this.allocationGranularity = 64 * KiB; // hardcoded for now
        this.reservations = [];
        this.pages = new Map();
    }

    pageForAddr(addr: number): WinPage {
        return this.pagesForRange(addr, 0)[0];
    }

    pagesForRange(base: number, length: number): WinPage[] {
        const start = roundDownTo(base, this.pageSize);
        const end = roundUpTo(base + length, this.pageSize);
        const res: WinPage[] = [];
        for (let addr = start; addr < end; addr += this.pageSize) {
            res.push(this.pages.get(addr) ?? {
                baseAddr: addr,
                ...defaultWinPage,
            });
        }
        return res;
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

    VirtualAlloc(
        lpAddress: number,
        dwSize: number,
        flAllocationType: WinAllocationType,
        flProtect: WinProtect,
    ): number {
        if (lpAddress === 0) {
            throw new Error("VirtualAlloc: lpAddress of NULL is not supported yet");
        }

        if (lpAddress === 0) {
            dwSize = roundUpTo(dwSize, this.pageSize);
        }
        if (flAllocationType & WinAllocationType.MEM_RESERVE) {
            lpAddress = roundDownTo(lpAddress, this.allocationGranularity);
        }
        if (flAllocationType & WinAllocationType.MEM_COMMIT) {
            lpAddress = roundDownTo(lpAddress, this.pageSize);
        }
        // TODO: What is the behavior when rounding down lpAddress? Does the function succeed but return the rounded-down value?

        // Validate the operation first, before touching memory
        if (flAllocationType & WinAllocationType.MEM_RESERVE) {
            // Ensure that all pages being reserved are free
            for (const page of this.pagesForRange(lpAddress, dwSize)) {
                if (page.state !== WinPageState.Free) {
                    throw new Error(`VirtualAlloc: MEM_RESERVE can only reserve free pages, but the page at address ${page.baseAddr} was ${page.state}`);
                }
            }
        }
        if (flAllocationType & WinAllocationType.MEM_COMMIT) {
            // TODO: I know we can commit pages that are already committed, but what if the protection values don't agree?
        }

        // Reserve pages
        if (flAllocationType & WinAllocationType.MEM_RESERVE) {
            for (const page of this.pagesForRange(lpAddress, dwSize)) {
                this.pages.set(page.baseAddr, {
                    ...page,
                    state: WinPageState.Reserved,
                });
            }
            this.reservations.push({
                base: lpAddress,
                length: dwSize,
            });
            console.log("Reserved", lpAddress, dwSize);
        }

        // Commit pages
        if (flAllocationType & WinAllocationType.MEM_COMMIT) {
            for (const page of this.pagesForRange(lpAddress, dwSize)) {
                this.pages.set(page.baseAddr, {
                    ...page,
                    state: WinPageState.Committed,
                    protection: flProtect,
                });
            }
            console.log("Committed", lpAddress, dwSize);
        }

        return lpAddress;
    }
}

export interface Instruction {
    winCall?: WinCall;
    // TODO: Mac and Linux calls.
}

export interface Program {
    instrs: Instruction[];
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
                m.VirtualAlloc(call.lpAddress, call.dwSize, call.flAllocationType, call.flProtect);
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
