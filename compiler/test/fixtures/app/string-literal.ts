import {Injectable, Inject} from "../injector-like";

@Injectable()
export class StringTokenConsumer {
    constructor(@Inject("some-string-token") value: unknown) {}
}
