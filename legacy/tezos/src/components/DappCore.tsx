import { TezosToolkit, OpKind } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import {
  NetworkType,
  BeaconEvent,
  defaultEventCallbacks
} from "@airgap/beacon-dapp";


const HARDCODED_CONTRACT_ALIAS_MAP : any = {
  "KT1JH9aWkTHiAvG9E4LCCXciGx83qoUqFCYw" : "$TRASH"
};

function hex2a(hexx:any) {
  var hex = hexx.toString();//force conversion
  var str = '';
  for (var i = 0; i < hex.length; i += 2)
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
}

interface IState {
  rpcUrl: string;
  Tezos: TezosToolkit;
  wallet: any; //BeaconWallet;
  userAddress: string;
  beaconConnection: boolean;
  publicToken: string | null;
}

export default class DappCore {
  state: IState;
  collectedTokens: any;
  vendingAddress: string;
  collect_failed: boolean;
  machine: number;
  wallet_tokens: any;
  sync_setter: any;
  FORCE_COLLECT_IMAGE_DISPLAY: boolean;

  constructor() {
    //const rpcUrl = "https://ithacanet.smartpy.io";
    //const rpcUrl = "https://jakartanet.smartpy.io";
    //const rpcUrl = "https://mainnet.smartpy.io";
    // ???
    const rpcUrl = "https://rpc.tzbeta.net";
    //const rpcUrl = "https://ghostnet.smartpy.io";
    //const rpcUrl = "https://ghostnet.ecadinfra.com";
    const Tezos = new TezosToolkit(rpcUrl);
    const wallet = null;
    const userAddress = "";
    const beaconConnection = false;
    const publicToken = "";
    
    this.collectedTokens = [];
    //this.vendingAddress = "KT1DL7PNULpzHFz4PP6oxG4zt5UdJkRn83HU"; // MAININET
    //this.vendingAddress = "KT1Q22xgbURv5hNdUyeKSswG9usYLMP91nvT"; // JAKAR
    //this.vendingAddress = "KT1UzjDKju7P372WTLvCiEGoVRCskfoQ4V8A"; // OLD
    //this.vendingAddress = "KT1RHEVmFy8ZB5vqq7u8NYswpP9eXwJKmU34"; // FEB 21, 2023
    //this.vendingAddress = "KT1WtoQ6pGtk9cMiKWN7PNyrTMMwv1Uu1sgk"; // TESTNET
    this.vendingAddress = "KT1E4X3uUvv6rCnnZT5MhXAjbrSrU5Zwynwq"; // JAN 25, 2024

    this.collect_failed = false;
    this.machine = 0;
    this.wallet_tokens = [];
    this.sync_setter = null;
    this.FORCE_COLLECT_IMAGE_DISPLAY = false;

    this.state = {
      rpcUrl: rpcUrl,
      Tezos: Tezos,
      wallet: wallet,
      userAddress: userAddress,
      beaconConnection: beaconConnection,
      publicToken: publicToken,
    };

    console.log(this.infer_network())

    if (this.state.wallet === null) {
      this.createWallet();
    }
    this.componentDidMount();
  }

  set_machine(x:any) {
    console.log("SET MACHINE :: ", x);
    this.machine = x;
  }

  set_sync_setter(x:any) {
    console.log("SETTING SYNCER ::")
    this.sync_setter = x;
    this.sync_setter(this.state.beaconConnection); // update now
  }

  infer_network() {
    if (this.state.rpcUrl.includes("ithaca")) {
      return NetworkType.ITHACANET;
    }
    else if (this.state.rpcUrl.includes("hangzhou")) {
      return NetworkType.HANGZHOUNET;
    }
    else if (this.state.rpcUrl.includes("granada")) {
      return NetworkType.GRANADANET;
    }
    else if (this.state.rpcUrl.includes("jakartanet")) {
      return NetworkType.JAKARTANET;
    }
    else if (this.state.rpcUrl.includes("ghostnet")) {
      return NetworkType.GHOSTNET;
    }
    return NetworkType.MAINNET;
  }

  createWallet () {
    const wallet = new BeaconWallet({
      name: "Vending NFTs",
      preferredNetwork: this.infer_network(),
      disableDefaultEvents: true, // Disable all events / UI. This also disables the pairing alert.
      eventHandlers: {
        // To keep the pairing alert, we have to add the following default event handlers back
        [BeaconEvent.PAIR_INIT]: {
          handler: defaultEventCallbacks.PAIR_INIT
        },
        [BeaconEvent.PAIR_SUCCESS]: {
          //handler: data => this.state.setPublicToken(data.publicKey)
          handler: data => this.setPublicToken(data)
        }
      }
    });
    this.state.Tezos.setWalletProvider(wallet);
    this.state.wallet = wallet;
  }

  connectWallet = async (): Promise<void> => {
    try {
      if (this.state.wallet === null) {
        this.createWallet();
      }
      await this.state.wallet.requestPermissions({
        network: {
          type: this.infer_network(),
          rpcUrl: this.state.rpcUrl
        }
      });
      // gets user's address
      const userAddress = await this.state.wallet.getPKH();
      this.state.userAddress = userAddress;
      this.state.beaconConnection = true;
      //this.state.setUserAddress(userAddress);
      //this.state.setBeaconConnection(true);
      this.wallet_tokens = await this.get_wallet_tokens();
      if (this.sync_setter !== null) {
        this.sync_setter(true);
      }
    } catch (error) {
      console.log(error);
    }
  };

  disconnectWallet = async (): Promise<void> => {
    //window.localStorage.clear();
    //this.state.setUserAddress("");
    //this.state.setWallet(null);
    this.state.userAddress = "";
    const tezosTK = new TezosToolkit(this.state.rpcUrl);
    //this.state.setTezos(tezosTK);
    //this.state.setBeaconConnection(false);
    //this.state.setPublicToken(null);
    this.state.Tezos = tezosTK;
    this.state.beaconConnection = false;
    this.state.publicToken = null;
    if (this.sync_setter !== null) {
      this.sync_setter(false);
    }
    console.log("disconnecting wallet");
    if (this.state.wallet) {
      await this.state.wallet.client.removeAllAccounts();
      await this.state.wallet.client.removeAllPeers();
      await this.state.wallet.client.destroy();
    }
    this.state.wallet = null;
  };

  setPublicToken(data:any) {
    this.state.publicToken = data.publicKey;
  }

  componentDidMount = async (): Promise<void> => {
    // execute on startup
    //this.state.setWallet(wallet);

    // auto sync
    const activeAccount = await this.state.wallet.client.getActiveAccount();
    if (activeAccount) {
      const userAddress = await this.state.wallet.getPKH();
      this.state.userAddress = userAddress;
      this.state.beaconConnection = true;
      this.wallet_tokens = await this.get_wallet_tokens();
      if (this.sync_setter !== null) {
        this.sync_setter(true);
      }
    }
    
  }


  // ========================================
  // contract methods
  // ========================================

  call_collect_token = async (amount:any,currency:string,currency_token_id:number): Promise<void> => {
    this.collect_failed = false;
    try {
        const contract = await this.state.Tezos.wallet.at(this.vendingAddress);
        const storage : any = await contract.storage();
        const data = await storage.machines.get(this.machine);
        const cost = data.price.get(amount.toString());

        let ops: any[] = [];
        if (currency === "xtz") {
          ops.push({
            kind: OpKind.TRANSACTION,
            ...contract.methods.collect_from_machine(this.machine, amount)
              .toTransferParams({ amount: cost, mutez: true, storageLimit: 500 })
          });
        }
        else {
          const fa2 = await this.state.Tezos.wallet.at(currency);
          ops.push({
            kind: OpKind.TRANSACTION,
            ...fa2.methods.update_operators([{ add_operator: { operator: this.vendingAddress, token_id: currency_token_id, owner: this.state.userAddress}}])
              .toTransferParams({ amount: 0, mutez: true, storageLimit: 100 })
          });
          ops.push({
            kind: OpKind.TRANSACTION,
            ...contract.methods.collect_from_machine(this.machine, amount, currency, currency_token_id)
              .toTransferParams({ amount: 0, mutez: true, storageLimit: 500 })
          });
          ops.push({
            kind: OpKind.TRANSACTION,
            ...fa2.methods.update_operators([{ remove_operator: { operator: this.vendingAddress, token_id: currency_token_id, owner: this.state.userAddress}}])
              .toTransferParams({ amount: 0, mutez: true, storageLimit: 100 })
          });
        }

        let batch = await this.state.Tezos.wallet.batch(ops);
        const op = await batch.send();
        const conf = await op.confirmation();

        // wait until tzkt is at the same level
        let level = await this.get_level();
        while ((conf !== undefined) && (level < conf.block.header.level)) {
          console.log("waiting for tzkt to catch up ...");
          level = await this.get_level();
        }

    } catch (error) {
        console.log(error);
        this.collect_failed = true;
    } finally {
      //do nothing
    }
  };

  burn_token = async (c:any,t:any): Promise<void> => {
    try {
      let ops: any[] = [];
      const contract = await this.state.Tezos.wallet.at(c);
      const burn = "tz1burnburnburnburnburnburnburjAYjjX"
      ops.push({
        kind: OpKind.TRANSACTION,
        ...contract.methods.transfer([{from_:this.state.userAddress,txs:[{to_:burn,token_id:t,amount:1}]}]).toTransferParams({storageLimit: 100})
      });

      let batch = await this.state.Tezos.wallet.batch(ops);
      const op = await batch.send();
      await op.confirmation();
    } catch (error) {
      console.log(error);
    } finally {
      //do nothing
    }
  };

  donate_token = async (token_index:any, amount:any): Promise<void | string> => {
    console.log(token_index, amount);
    const fa2Address = this.wallet_tokens[token_index].fa2;
    const tokenId = this.wallet_tokens[token_index].token_id;
    const name = this.wallet_tokens[token_index].name
    console.log(fa2Address, tokenId, amount, name);
    try {

      const contract = await this.state.Tezos.wallet.at(this.vendingAddress);

      /*

      const fa2 = await this.state.Tezos.wallet.at(fa2Address);
      let ops :any[] = [];
      ops.push({
        kind: OpKind.TRANSACTION,
        ...fa2.methods.update_operators([{ add_operator: { operator: this.vendingAddress, token_id: tokenId, owner: this.state.userAddress } }])
          .toTransferParams({ amount: 0, mutez: true, storageLimit: 100 })
      });
      ops.push({
        kind: OpKind.TRANSACTION,
        ...contract.methods.add_to_machine(this.machine,fa2Address,tokenId,amount,0)
          .toTransferParams({ amount: 0, mutez: true, storageLimit: 500 })
      });
      ops.push({
        kind: OpKind.TRANSACTION,
        ...fa2.methods.update_operators([{ remove_operator: { operator: this.vendingAddress, token_id: tokenId, owner: this.state.userAddress } }])
          .toTransferParams({ amount: 0, mutez: true, storageLimit: 100 })
      });

      */

      // just send to donate wallet instead
      const fa2 = await this.state.Tezos.wallet.at(fa2Address);
      let ops :any[] = [];
      ops.push({
        kind: OpKind.TRANSACTION,
        ...fa2.methods.transfer([{from_:this.state.userAddress,txs:[{to_:"tz1LwtYtbchiga4rYFy6P3BFaKn44ptEjdjm",token_id:tokenId,amount:amount}]}]).toTransferParams({amount: 0, mutez: true, storageLimit: 500})
      });

      let batch = await this.state.Tezos.wallet.batch(ops);
      const op = await batch.send();
      await op.confirmation();

      this.wallet_tokens = await this.get_wallet_tokens(); // update list
      return 'success';
    } catch (error) {
      console.log("returning ...")
      return 'failed';
    } finally {
      // do nothing
    }
  };


  
  tzkt_query = async (url:any): Promise<any> => {
    try {
      const network = this.infer_network();
      const base_url = "https://api." + network + ".tzkt.io/v1/";
      console.log(base_url + url);
      let response = await fetch(base_url + url);
      let data = await response.json();
      return data;
    } catch (error) {
      console.log("TZKT QUERY FAILED ....");
      console.log(error);
    }
    return null;
  }

  get_level = async (): Promise<number> => {
    let data = await this.tzkt_query("head");
    if (data !== null) {
      return parseInt(data.level);
    }
    return -1;
  }

  get_contract_alias = async (address:string): Promise<string> => {
    try {
      let url = "contracts/" + address;
      let data = await this.tzkt_query(url);
      return data.alias === undefined ? address : data.alias;
    }
    catch {
      console.log("COULD NOT GET CONTRACT ALIAS ...");
      return address;
    }
  }

  get_token_decimals = async (address:string, token_id:number): Promise<number> => {
    try {
      let url = "contracts/" + address + "/bigmaps/token_metadata/keys/" + token_id.toString();
      let data = await this.tzkt_query(url);
      return parseInt(data.value.token_info.decimals) - 30; // tzkt adds 30 to all the decimals ???
    }
    catch {
      console.log("COULD NOT GET TOKEN DECIMALS ...");
      return 0;
    }
  }

  get_machine_data = async (): Promise<any> => {
    try {
      let url = "contracts/" + this.vendingAddress + "/bigmaps/machines/keys/" + this.machine.toString();
      let data = await this.tzkt_query(url);
      let alias_map : any = {};
      let token_id_map : any = {};
      let token_price_map : any = {};
  
      for (const item of data.value.fa2_price) {
        if (item.key.address in HARDCODED_CONTRACT_ALIAS_MAP) {
          alias_map[item.key.address] = HARDCODED_CONTRACT_ALIAS_MAP[item.key.address];
        }
        else {
          alias_map[item.key.address] = await this.get_contract_alias(item.key.address);
        }
        const factor = await this.get_token_decimals(item.key.address, parseInt(item.key.nat));
        token_id_map[item.key.address] = parseInt(item.key.nat);
        token_price_map[item.key.address] = Object.fromEntries(Object.entries(item.value).map(([k,v]:[any,any]) => [k, (parseFloat(v) / Math.pow(10,factor)).toString()]));
      }
      let output : any = data.value;
      output["alias_map"] = alias_map;
      output["token_id_map"] = token_id_map;
      output["token_price_map"] = token_price_map;
      console.log(output);
      return output;
    }
    catch {
      console.log("COULD NOT GET MACHINE DATA ...");
      return undefined;
    }
  }

  get_token_count = async (): Promise<number> => {
    try {
      //let url = "contracts/" + this.vendingAddress + "/bigmaps/token_db_edition_count/keys/" + (this.machine * 2 + 1).toString();
      let url = "contracts/" + this.vendingAddress + "/bigmaps/token_db_count/keys/" + (this.machine * 2 + 1).toString();
      let data = await this.tzkt_query(url);
      console.log(parseInt(data.value.edition_count));
      return parseInt(data.value.edition_count);
    } catch {
      console.log("COULD NOT GET TOKEN COUNT ...");
      return 0;
    }
  }

  get_price = async (): Promise<any> => {
    try {
      let url = "contracts/" + this.vendingAddress + "/bigmaps/machines/keys/" + this.machine.toString();
      let data = await this.tzkt_query(url);
      let price = data.value.price;
      Object.keys(price).forEach(function(key, index) {
        price[key] = (parseFloat(price[key]) / 1000000).toString();
      });
      console.log(price);
      return price;
    } catch {
      return {1: '-', 3: '-'};
    }
  }

  get_ipfs_uri = async (c:any,t:any) : Promise<string> => {
    let url = "contracts/" + c + "/bigmaps/token_metadata/keys/" + t.toString();
    let data = await this.tzkt_query(url);
    return hex2a(data["value"]["token_info"][""]);
  }

  clean_creator(x:any) {
    if (Array.isArray(x)) {
      return x.join(", ");
    }
    return x;
  }

  get_token_metadata = async (c:any,t:any) : Promise<any> => {
    let url = "tokens?contract=" + c + "&tokenId=" + t.toString();
    let data = await this.tzkt_query(url);
    try {
      return {
        name: data[0]["metadata"]["name"],
        creators: this.clean_creator(data[0]["metadata"]["creators"]),
        io_image: "https://infiniteobjects.infura-ipfs.io/" + data[0]["metadata"]["artifactUri"].substring(7),
        //image: "https://raw.githubusercontent.com/vendingmachinedeveloper/vendingmachinemetadata/main/" + c + "_" + t.toString() + ".jpeg",
        image: "https://vendingnfts.s3.amazonaws.com/" + c + "_" + t.toString() + "_display.jpeg",
        tokenId: t,
        fa2: c,
      }
    } catch {
      return {
        name: "Undefined Token=" + t.toString(),
        creators: "Undefined",
        image: "",
        tokenId: t,
        fa2: c,
      }
    }
  }

  get_info = async (amount:any): Promise<any> => {

    let tokenData :any[] = [];
    if ((this.collect_failed == false) || (this.FORCE_COLLECT_IMAGE_DISPLAY)) {

      let collector_address = this.state.userAddress;
      if (this.FORCE_COLLECT_IMAGE_DISPLAY) {
        collector_address = "tz1gVbpaamDxgfZySTqKmG69AHrKZeb2pxmy";
      }

      const data = await this.tzkt_query("operations/transactions?sender=" + this.vendingAddress + "&entrypoint=transfer&parameter.[*].txs.[*].to_=" + collector_address + "&sort=id");
      
      for (const tran of data.reverse()) {
        if (tran.parameter.entrypoint == "transfer") {
          let fa2 = tran.target.address;
          for (const item of tran.parameter.value) {
            for (const tx of item.txs) {
              if (tx.to_ == collector_address) {
                let metadata = await this.get_token_metadata(fa2,tx.token_id);
                tokenData.push( metadata );
              }
            }
          }
        }
        if (tokenData.length >= amount) {
          break;
        }
      }

      /*
      let c = await this.state.Tezos.wallet.at(this.vendingAddress);
      let storage : any = await c.storage();
      let collected = await storage.collected.get(this.state.userAddress);

      if (collected !== undefined) {
        let size = parseInt(collected.size);      
        for (let i=size - amount; i<size; i++) {
          let token = await collected.get(i.toString());
          let metadata = await this.get_token_metadata(token['0'],token['1']);
          tokenData.push( metadata );
        }
      }
      */
    }
    //var offset = Math.floor(Math.random() * (tokenData.length - 3 - 0.001));
    //this.collectedTokens = tokenData.slice(offset, amount + offset);
    this.collectedTokens = tokenData.slice(0, amount);
  }

  get_wallet_tokens = async(): Promise<any> => {
    //let force_addr = "tz1Mn66CLYJUmsrYSy23EFtdWBkHgqCooCzi";
    let url = "tokens/balances?limit=10000&account=" + this.state.userAddress;
    let data = await this.tzkt_query(url);
    let tokenData: any[] = [];
    if (data !== null) {
      for (const item of data) {
        let name = "Undefined";
        try {
          name = item.token.metadata.name;
        }
        catch {}
        if (name === undefined) {
          name = "Undefined";
        }
        if (parseInt(item.balance) > 0) {
          tokenData.push({
            fa2: item.token.contract.address,
            token_id: item.token.tokenId,
            name: name,
            balance: parseInt(item.balance)
          });
        }
      }
      //console.log(tokenData.length);
      // sort data by name
      tokenData.sort((a, b) => {return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1});
    }
    return tokenData;
  }
}
