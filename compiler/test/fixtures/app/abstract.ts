import {Injectable} from "../injector-like";

export abstract class Logger {
    abstract log(message: string): void;
}

@Injectable()
export class ConsoleLogger extends Logger {
    log(message: string) {}
}

@Injectable()
export class AbstractConsumer {
    constructor(logger: Logger) {}
}
