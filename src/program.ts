// Types for the user program

import { WinAllocationType, WinFreeType, WinProtect } from "./windows";

interface Memset {
    base: number;
    value: number;
    length: number;
}

/**
 * Calls that are available on all platforms. Note that these might not
 * _behave_ the same on all platforms, but at least they exist everywhere.
 */
type CommonCall = Memset;

interface WinVirtualAlloc {
    lpAddress: number;
    dwSize: number;
    flAllocationType: WinAllocationType;
    flProtect: WinProtect;
}

interface WinVirtualFree {
    lpAddress: number;
    dwSize: number;
    dwFreeType: WinFreeType;
}

type WinCall = CommonCall | WinVirtualAlloc | WinVirtualFree;

interface Instruction {
    winCall?: WinCall;
    // TODO: Mac and Linux calls.
}
