import {Component, Inject} from "nodeboot-like";

export const LOGGER = Symbol("LOGGER");

export interface Logger {
    log(message: string): void;
}

// Decorated with @Component()/@Inject() from ../nodeboot-like, NOT @Injectable()/@Inject() from
// ../injector-like - only recognized when the compiler is configured with an additional
// decorator source pointing at ../nodeboot-like.
@Component()
export class AdditionalSourceConsumer {
    constructor(@Inject(LOGGER) logger: Logger) {}
}
