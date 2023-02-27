export interface WinReservation {
    base: number;
    length: number;
}

export type WinPageState = "free" | "reserved" | "committed";

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

export interface WinPage {
    state: WinPageState;
    protection: WinProtect;
}

export interface WinMemory {
    mem: number[];
    pageSize: number;
    reservations: WinReservation[];
    pages: Map<number, WinPage>;
}
