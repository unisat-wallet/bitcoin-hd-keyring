import { SimpleKeyring } from "@unisat/bitcoin-simple-keyring";
import * as bitcoin from "bitcoinjs-lib";
import ECPairFactory, { ECPairInterface } from "ecpair";
import * as ecc from "tiny-secp256k1";
import bitcore from "bitcore-lib";
import Mnemonic from "bitcore-mnemonic";
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const hdPathString = "m/44'/0'/0'/0";
const type = "HD Key Tree";

interface DeserializeOption {
  hdPath?: string;
  mnemonic?: string;
  activeIndexes?: number[];
  passphrase?: string;
}

export class HdKeyring extends SimpleKeyring {
  static type = type;

  type = type;
  mnemonic: string = null;
  passphrase: string;
  network: bitcoin.Network = bitcoin.networks.bitcoin;

  hdPath = hdPathString;
  root: bitcore.HDPrivateKey = null;
  hdWallet?: Mnemonic;
  wallets: ECPairInterface[] = [];
  private _index2wallet: Record<number, [string, ECPairInterface]> = {};
  activeIndexes: number[] = [];
  page = 0;
  perPage = 5;

  /* PUBLIC METHODS */
  constructor(opts?: DeserializeOption) {
    super(null);
    this.deserialize(opts);
  }

  async serialize(): Promise<DeserializeOption> {
    return {
      mnemonic: this.mnemonic,
      activeIndexes: this.activeIndexes,
      hdPath: this.hdPath,
      passphrase: this.passphrase,
    };
  }

  async deserialize(_opts: DeserializeOption = {}) {
    if (this.root) {
      throw new Error(
        "Btc-Hd-Keyring: Secret recovery phrase already provided"
      );
    }
    let opts = _opts as DeserializeOption;
    this.wallets = [];
    this.mnemonic = null;
    this.root = null;
    this.hdPath = opts.hdPath || hdPathString;

    if (opts.passphrase) {
      this.passphrase = opts.passphrase;
    }

    if (opts.mnemonic) {
      this.initFromMnemonic(opts.mnemonic);
    }

    if (opts.activeIndexes) {
      this.activeAccounts(opts.activeIndexes);
    }
  }

  initFromMnemonic(mnemonic: string) {
    if (this.root) {
      throw new Error(
        "Btc-Hd-Keyring: Secret recovery phrase already provided"
      );
    }

    this.mnemonic = mnemonic;
    this._index2wallet = {};

    this.hdWallet = new Mnemonic(mnemonic);
    this.root = this.hdWallet
      .toHDPrivateKey(
        this.passphrase,
        this.network == bitcoin.networks.bitcoin ? "livenet" : "testnet"
      )
      .deriveChild(this.hdPath);
  }

  addAccounts(numberOfAccounts = 1) {
    if (!this.root) {
      this.initFromMnemonic(new Mnemonic().toString());
    }

    let count = numberOfAccounts;
    let currentIdx = 0;
    const newWallets: ECPairInterface[] = [];

    while (count) {
      const [, wallet] = this._addressFromIndex(currentIdx);
      if (this.wallets.includes(wallet)) {
        currentIdx++;
      } else {
        this.wallets.push(wallet);
        newWallets.push(wallet);
        this.activeIndexes.push(currentIdx);
        count--;
      }
    }

    const hexWallets = newWallets.map((w) => {
      return w.publicKey.toString("hex");
    });

    return Promise.resolve(hexWallets);
  }

  activeAccounts(indexes: number[]) {
    const accounts: string[] = [];
    for (const index of indexes) {
      const [address, wallet] = this._addressFromIndex(index);
      this.wallets.push(wallet);
      this.activeIndexes.push(index);

      accounts.push(address);
    }

    return accounts;
  }

  getFirstPage() {
    this.page = 0;
    return this.__getPage(1);
  }

  getNextPage() {
    return this.__getPage(1);
  }

  getPreviousPage() {
    return this.__getPage(-1);
  }

  getAddresses(start: number, end: number) {
    const from = start;
    const to = end;
    const accounts: { address: string; index: number }[] = [];
    for (let i = from; i < to; i++) {
      const [address] = this._addressFromIndex(i);
      accounts.push({
        address,
        index: i + 1,
      });
    }
    return accounts;
  }

  async __getPage(increment: number) {
    this.page += increment;

    if (!this.page || this.page <= 0) {
      this.page = 1;
    }

    const from = (this.page - 1) * this.perPage;
    const to = from + this.perPage;

    const accounts: { address: string; index: number }[] = [];

    for (let i = from; i < to; i++) {
      const [address] = this._addressFromIndex(i);
      accounts.push({
        address,
        index: i + 1,
      });
    }

    return accounts;
  }

  async getAccounts() {
    return this.wallets.map((w) => {
      return w.publicKey.toString("hex");
    });
  }

  getIndexByAddress(address: string) {
    for (const key in this._index2wallet) {
      if (this._index2wallet[key][0] === address) {
        return Number(key);
      }
    }
    return null;
  }

  private _addressFromIndex(i: number): [string, ECPairInterface] {
    if (!this._index2wallet[i]) {
      const child = this.root!.deriveChild(i);
      const ecpair = ECPair.fromPrivateKey(child.privateKey.toBuffer());
      const address = ecpair.publicKey.toString();
      this._index2wallet[i] = [address, ecpair];
    }

    return this._index2wallet[i];
  }
}
