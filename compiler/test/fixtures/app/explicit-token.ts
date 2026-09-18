import {Injectable, Inject} from "../injector-like";

export const LOGGER = Symbol("LOGGER");

export interface Logger {
    log(message: string): void;
}

@Injectable()
export class ExplicitTokenConsumer {
    constructor(@Inject(LOGGER) logger: Logger) {}
}
