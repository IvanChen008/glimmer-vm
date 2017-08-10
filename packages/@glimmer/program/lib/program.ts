
import { Recast } from "@glimmer/interfaces";
import { DEBUG } from "@glimmer/local-debug-flags";
import { Constants, WriteOnlyConstants } from './constants';
import { Opcode } from './opcode';
import { Handle, CompileTimeProgram } from "@glimmer/opcode-compiler";

enum TableSlotState {
  Allocated,
  Freed,
  Purged,
  Pointer
}

export class Heap {
  private heap: number[] = [];
  private offset = 0;
  private handle = 0;

  /**
   * layout:
   *
   * - pointer into heap
   * - size
   * - freed (0 or 1)
   */
  private table: number[] = [];

  push(item: number): void {
    this.heap[this.offset++] = item;
  }

  getbyaddr(address: number): number {
    return this.heap[address];
  }

  setbyaddr(address: number, value: number) {
    this.heap[address] = value;
  }

  reserve(): Handle {
    this.table.push(0, 0, 0);
    let handle = this.handle;
    this.handle += 3;
    return handle as Recast<number, Handle>;
  }

  malloc(): Handle {
    this.table.push(this.offset, 0, 0);
    let handle = this.handle;
    this.handle += 3;
    return handle as Recast<number, Handle>;
  }

  finishMalloc(handle: Handle): void {
    let start = this.table[handle as Recast<Handle, number>];
    let finish = this.offset;
    this.table[(handle as Recast<Handle, number>) + 1] = finish - start;
  }

  size(): number {
    return this.offset;
  }

  // It is illegal to close over this address, as compaction
  // may move it. However, it is legal to use this address
  // multiple times between compactions.
  getaddr(handle: Handle): number {
    return this.table[handle as Recast<Handle, number>];
  }

  gethandle(address: number): Handle {
    this.table.push(address, 0, TableSlotState.Pointer);
    let handle = this.handle;
    this.handle += 3;
    return handle as Recast<number, Handle>;
  }

  sizeof(handle: Handle): number {
    if (DEBUG) {
      return this.table[(handle as Recast<Handle, number>) + 1];
    }
    return -1;
  }

  free(handle: Handle): void {
    this.table[(handle as Recast<Handle, number>) + 2] = 1;
  }

  compact(): void {
    let compactedSize = 0;
    let { table, table: { length }, heap } = this;

    for (let i=0; i<length; i+=3) {
      let offset = table[i];
      let size = table[i + 1];
      let state = table[i + 2];

      if (state === TableSlotState.Purged) {
        continue;
      } else if (state === TableSlotState.Freed) {
        // transition to "already freed"
        // a good improvement would be to reuse
        // these slots
        table[i + 2] = 2;
        compactedSize += size;
      } else if (state === TableSlotState.Allocated) {
        for (let j=offset; j<=i+size; j++) {
          heap[j - compactedSize] = heap[j];
        }

        table[i] = offset - compactedSize;
      } else if (state === TableSlotState.Pointer) {
        table[i] = offset - compactedSize;
      }
    }

    this.offset = this.offset - compactedSize;
  }
}

export class WriteOnlyProgram<Handle> implements CompileTimeProgram {
  [key: number]: never;

  private _opcode: Opcode;
  public heap: Heap;

  constructor(public constants: WriteOnlyConstants<Handle>) {
    this.heap = new Heap();
    this._opcode = new Opcode(this.heap);
  }

  opcode(offset: number): Opcode {
    this._opcode.offset = offset;
    return this._opcode;
  }
}

export class Program<Specifier, Handle> extends WriteOnlyProgram<Handle> {
  public constants: Constants<Specifier, Handle>;
}
