import { EventEmitter } from 'node:events'

export type RfidScanEvent = { uid: string; scannedAt: string; source: string }
export interface Reader { readonly events: EventEmitter; start(): Promise<void> | void; stop(): Promise<void> | void }

export abstract class BaseReader implements Reader {
  readonly events = new EventEmitter()
  abstract start(): Promise<void> | void
  abstract stop(): Promise<void> | void
  protected emitScan(uid: string, source: string): void {
    this.events.emit('scan', { uid, source, scannedAt: new Date().toISOString() } satisfies RfidScanEvent)
  }
}
