import { hashPin, verifyPinHash, encrypt, decrypt } from "./server/services/crypto";

async function test() {
  try {
    console.log("Hashing...");
    const { salt, hash } = await hashPin("1234");
    console.log("Hash:", hash);
    const enc = await encrypt("hello world", "1234", salt);
    console.log("Encrypted:", enc);
    const dec = await decrypt(enc, "1234", salt);
    console.log("Decrypted:", dec);
  } catch(e) {
    console.error("ERROR", e);
  }
}
test();
