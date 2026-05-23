import { BaseReader } from './reader'

export class KeyboardWedgeReader extends BaseReader {
  start(): void { console.info('Keyboard-wedge RFID input is captured in the renderer via keydown buffering.') }
  stop(): void { console.info('Keyboard-wedge RFID renderer capture stopped with the window lifecycle.') }
}
