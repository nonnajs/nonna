import {Injectable} from "../injector-like";

export interface Logger {
    log(message: string): void;
}

@Injectable()
export class BrokenConsumer {
    constructor(logger: Logger) {}
}
