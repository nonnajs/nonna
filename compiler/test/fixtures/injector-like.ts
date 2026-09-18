// Stands in for @nonnajs/di's public decorator API in fixture programs, so tests don't
// need to build against the real published package.
export type Constructor<T = unknown> = new (...args: any[]) => T;
export type AbstractConstructor<T = unknown> = abstract new (...args: any[]) => T;
export type Token<T = unknown> = Constructor<T> | AbstractConstructor<T> | symbol | string;

export function Injectable(_options?: {scope?: string; eager?: boolean}) {
    return (_target: Function) => {};
}
export const Service = Injectable;

export function Inject(_token?: Token) {
    return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {};
}

export function Optional(_token?: Token) {
    return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {};
}

export function defineDependencies(_target: Constructor, _deps: unknown[]): void {}
