/**
 * Minimal type declarations for node-pty
 *
 * Only includes the subset of the API used in this project.
 */

declare module 'node-pty' {
    export interface IPtyForkOptions {
        name?: string;
        cols?: number;
        rows?: number;
        cwd?: string;
        env?: { [key: string]: string };
        encoding?: string;
        handleFlowControl?: boolean;
        flowControlPause?: string;
        flowControlResume?: string;
    }

    export interface IPty {
        onData(listener: (data: string) => void): void;
        onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
        write(data: string): void;
        resize(cols: number, rows: number): void;
        kill(signal?: string): void;
        readonly pid: number;
        readonly process: string;
    }

    export function spawn(file: string, args: string[] | string, options?: IPtyForkOptions): IPty;
}
