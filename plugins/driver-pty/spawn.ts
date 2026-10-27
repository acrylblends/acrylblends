/** The one place that touches `node-pty`, a native module. Everything else works on this small seam, so tests run on a fake process. */

export interface PtyProcess {
  readonly pid: number
  onData(listener: (chunk: string) => void): void
  onExit(listener: (exit: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  /** Ends the process; on Windows this is how it ends (ConPTY has no process groups). */
  kill(): void
}

export type PtySpawn = (
  file: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; cols: number; rows: number },
) => PtyProcess

/** Loads node-pty. Rejects with the reason (the error and the platform), so a log says why the driver is not offered. */
export async function loadNodePty(): Promise<PtySpawn> {
  try {
    const pty = await import('node-pty')
    return (file, args, options) =>
      pty.spawn(file, args, {
        name: 'xterm-256color',
        cwd: options.cwd,
        env: options.env as Record<string, string>,
        cols: options.cols,
        rows: options.rows,
      })
  } catch (error) {
    throw new Error(
      `node-pty could not be loaded on ${process.platform}/${process.arch}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
