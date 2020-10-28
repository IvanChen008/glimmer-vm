import {
  RuntimeResolver,
  AnnotatedModuleLocator,
  Option,
  ComponentDefinition,
  Invocation,
} from '@glimmer/interfaces';
import { LookupType, TestJitRegistry } from './registry';

export default class TestJitRuntimeResolver implements RuntimeResolver {
  readonly registry = new TestJitRegistry();

  lookup(
    type: LookupType,
    name: string,
    referrer?: Option<AnnotatedModuleLocator>
  ): Option<number> {
    return this.registry.lookup(type, name, referrer);
  }

  getInvocation(_locator: AnnotatedModuleLocator): Invocation {
    throw new Error(`getInvocation is not supported in JIT mode`);
  }

  lookupHelper(name: string, referrer?: Option<AnnotatedModuleLocator>): Option<number> {
    return this.lookup('helper', name, referrer);
  }

  lookupModifier(name: string, referrer?: Option<AnnotatedModuleLocator>): Option<number> {
    return this.lookup('modifier', name, referrer);
  }

  lookupComponent(
    name: string,
    referrer: Option<AnnotatedModuleLocator>
  ): Option<ComponentDefinition> {
    let handle = this.registry.lookupComponentHandle(name, referrer);
    if (handle === null) return null;
    return this.resolve(handle) as ComponentDefinition;
  }

  lookupPartial(name: string, referrer?: Option<AnnotatedModuleLocator>): Option<number> {
    return this.lookup('partial', name, referrer);
  }

  resolve<T>(handle: number): T {
    return this.registry.resolve(handle);
  }
}
