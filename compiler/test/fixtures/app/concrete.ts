import {Injectable} from "../injector-like";

@Injectable()
export class UserRepository {}

@Injectable()
export class UserService {
    constructor(repository: UserRepository) {}
}
