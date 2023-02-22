import { expect } from "chai";
import { HdKeyring } from "../src";
const sampleMnemonic =
  "finish oppose decorate face calm tragic certain desk hour urge dinosaur mango";
const firstAcct =
  "025d7c14ab260a6932bc5484a0d9791f5cce66b0c6e1e4d7aee1e6bd294459e7d9";
const secondAcct =
  "0306cd1266c7dfc5522d1f170fa45cca29a7071a5dad848204b676cbd398aa7d30";
describe("bitcoin-hd-keyring", () => {
  describe("constructor", () => {
    it("constructs with a typeof string mnemonic", async () => {
      const keyring = new HdKeyring({
        mnemonic: sampleMnemonic,
        activeIndexes: [0, 1],
      });

      const accounts = await keyring.getAccounts();
      expect(accounts[0]).eq(firstAcct);
      expect(accounts[1]).eq(secondAcct);
    });
  });

  describe("re-initialization protection", () => {
    const alreadyProvidedError =
      "Btc-Hd-Keyring: Secret recovery phrase already provided";
    it("double generateRandomMnemonic", () => {
      const keyring = new HdKeyring();
      keyring.initFromMnemonic(sampleMnemonic);
      expect(() => {
        keyring.initFromMnemonic(sampleMnemonic);
      }).throw(alreadyProvidedError);
    });

    it("constructor + generateRandomMnemonic", () => {
      const keyring = new HdKeyring({
        mnemonic: sampleMnemonic,
        activeIndexes: [0, 1],
      });

      expect(() => {
        keyring.initFromMnemonic(sampleMnemonic);
      }).throw(alreadyProvidedError);
    });
  });

  describe("Keyring.type", () => {
    it("is a class property that returns the type string.", () => {
      const { type } = HdKeyring;
      expect(typeof type).eq("string");
    });
  });

  describe("#type", () => {
    it("returns the correct value", () => {
      const keyring = new HdKeyring();

      const { type } = keyring;
      const correct = HdKeyring.type;
      expect(type).eq(correct);
    });
  });
});
