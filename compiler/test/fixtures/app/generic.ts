import {Injectable} from "../injector-like";

export class Repository<T> {
    findById(_id: string): T | undefined {
        return undefined;
    }
}

export class User {}

@Injectable()
export class GenericConsumer {
    constructor(repo: Repository<User>) {}
}
