import { LinkedList, DESTROY } from '@glimmer/util';
import Environment from '../environment';
import { DestroyableBounds, clear } from '../bounds';
import UpdatingVM, { ExceptionHandler } from './update';
import { UpdatingOpcode } from '../opcodes';
import { Simple, Opaque } from '@glimmer/interfaces';
import { RuntimeProgram } from './append';
import { LiveBlock } from './element-builder';
import { associate } from '../lifetime';
import { destructor, DROP } from '../lifetime/destructor';

export default class RenderResult<T = Opaque> implements DestroyableBounds, ExceptionHandler {
  constructor(
    public env: Environment,
    private program: RuntimeProgram<T>,
    private updating: LinkedList<UpdatingOpcode>,
    private bounds: LiveBlock
  ) {
    associate(this, bounds);
  }

  rerender({ alwaysRevalidate = false } = { alwaysRevalidate: false }) {
    let { env, program, updating } = this;
    let vm = new UpdatingVM(env, program, { alwaysRevalidate });
    vm.execute(updating, this);
  }

  parentElement(): Simple.Element {
    return this.bounds.parentElement();
  }

  firstNode(): Simple.Node {
    return this.bounds.firstNode();
  }

  lastNode(): Simple.Node {
    return this.bounds.lastNode();
  }

  handleException() {
    throw 'this should never happen';
  }

  [DESTROY]() {
    clear(this.bounds);
  }

  // compat, as this is a user-exposed API
  destroy() {
    destructor(this)[DROP]();
  }
}
