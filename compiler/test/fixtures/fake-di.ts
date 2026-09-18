// Simulates another library's own `Inject` export - same name as @nonnajs/di's `Inject`,
// different declaration entirely. The scanner/resolver must tell these apart by symbol
// identity, never by name, or this collision would silently misfire.
export function Inject(_token?: unknown) {
    return (_target: object, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {};
}
