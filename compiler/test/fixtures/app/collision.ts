import {Injectable} from "../injector-like";
import {Inject} from "../fake-di";

export interface Logger {
    log(message: string): void;
}

// This @Inject comes from ../fake-di, NOT ../injector-like - the resolver must not mistake it
// for our own @Inject and must still fall through to (failing) inference on the interface type.
@Injectable()
export class CollisionConsumer {
    constructor(@Inject() logger: Logger) {}
}
