import * as crypto from "crypto";
import os from "os";

export function generateRandomKey(length = 6, encoding: BufferEncoding = "base64") {
    return crypto.randomBytes(length).toString(encoding);
}

export function generateClientName(){
    return `${os.hostname()}-${generateRandomKey()}`
}
