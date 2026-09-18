import {Injectable, Optional} from "../injector-like";

@Injectable()
export class Metrics {}

@Injectable()
export class OptionalNoTokenConsumer {
    constructor(@Optional() metrics?: Metrics) {}
}

export const METRICS_TOKEN = Symbol("METRICS_TOKEN");

@Injectable()
export class OptionalWithTokenConsumer {
    constructor(@Optional(METRICS_TOKEN) metrics?: unknown) {}
}
