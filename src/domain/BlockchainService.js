import Web3 from 'web3';
import SplitETHJSON from '../build/contracts/SplitETH.json';
import SETokenJSON from '../build/contracts/SEToken.json';
import { NETWORK_ID, ADDRESSES } from './config';
import { cleanAsciiText, toWei } from '../components/Expenses';
import { observable } from 'mobx';
import BigNumber from 'bignumber.js';

class BlockchainServiceClass {
  web3;
  web3WH;

  _initializationPromise;
  _initializationPromiseResolver;

  constructor() {
    // Web3 providers
    this.web3 = new Web3(Web3.givenProvider || 'http://kovan.infura.io');
    this.web3WH = new Web3();

    const eventProvider = new Web3.providers.WebsocketProvider(
      //  'wss://kovan.infura.io/websockets'
      // 'wss://rarely-suitable-shark.quiknode.io/87817da9-942d-4275-98c0-4176eee51e1a/aB5gwSfQdN4jmkS65F1HyA==/'
      'ws://localhost:8545'
    );

    this.web3WH.setProvider(eventProvider);

    console.log({
      assdd: SplitETHJSON.networks,
      networkID: NETWORK_ID,
      mix: SplitETHJSON.networks[NETWORK_ID]
    });

    const splitETHABI = SplitETHJSON.abi;

    const SETABI = SETokenJSON.abi;

    this.splitETH = new this.web3.eth.Contract(splitETHABI, ADDRESSES.SPLITTER);
    this.splitETH_event = new this.web3WH.eth.Contract(splitETHABI, ADDRESSES.SPLITTER);
    this.splitETH_event.setProvider(this.web3WH.currentProvider);

    this.seToken = new this.web3.eth.Contract(SETABI, ADDRESSES.TOKEN);
    this.seToken_event = new this.web3WH.eth.Contract(SETABI, ADDRESSES.TOKEN);
    this.seToken_event.setProvider(this.web3WH.currentProvider);

    this._initializationPromise = new Promise(
      resolve => (this._initializationPromiseResolver = resolve)
    );

    this.tokenBalance = observable.box(0);
    this.initialized = observable.box(false);

    this._initialize();
  }

  async waitForInitialization() {
    return this._initializationPromise;
  }

  async _initialize() {
    await this.updateAccounts();
    await this.updateCurrentBlock();
    await this.getGroupCreatedEvents();
    await this.setupUpdateGroupCreatedEventsWatch();

    this.tokenBalance.set(await this.getTokenBalance());

    this.onTokenBalanceUpdate(balance => this.tokenBalance.set(balance));
    this.initialized.set(true);

    this._initializationPromiseResolver();
  }

  get defaultAccount() {
    return this.accounts && this.accounts[0];
  }

  _groupCreatedEvents;
  _groupCreatedEventsLastFetchedBlock;

  currentBlock;

  async updateCurrentBlock() {
    this.currentBlock = await this.web3.eth.getBlockNumber();
  }

  async getGroupCreatedEvents() {
    await this.updateCurrentBlock();

    const GROUP_CREATED_EVENTS_KEY = this._getCachedGroupCreatedEventsKey();
    const GROUP_CREATED_EVENTS_LAST_FETCHED_BLOCK_KEY = this._getCachedGroupCreatedEventsLastFetchedBlockKey();

    const cachedEvents = window.localStorage.getItem(GROUP_CREATED_EVENTS_KEY);

    if (cachedEvents) {
      this._groupCreatedEvents = JSON.parse(cachedEvents);

      return this._groupCreatedEvents;
    }

    this._groupCreatedEvents = await this.splitETH_event.getPastEvents('GroupCreated', {
      fromBlock: this._getCachedGroupCreatedEventsLastFetchedBlock(),
      toBlock: 'latest'
    });

    window.localStorage.setItem(GROUP_CREATED_EVENTS_KEY, JSON.stringify(this._groupCreatedEvents));
    window.localStorage.setItem(GROUP_CREATED_EVENTS_LAST_FETCHED_BLOCK_KEY, this.currentBlock);

    return this._groupCreatedEvents;
  }

  _getCachedGroupCreatedEventsKey() {
    return `${NETWORK_ID}_groupCreatedEvents`;
  }

  _getCachedGroupCreatedEventsLastFetchedBlock() {
    return window.localStorage.getItem(this._getCachedGroupCreatedEventsLastFetchedBlockKey()) || 0;
  }

  _getCachedGroupCreatedEventsLastFetchedBlockKey() {
    return `${NETWORK_ID}_groupCreatedEventsLastFetchedBlock`;
  }

  async getGroups(fetchParticipants = true) {
    await this.waitForInitialization();

    const events = await this.getGroupCreatedEvents();

    const groups = [];

    for (let element of events) {
      var friends = [];

      if (fetchParticipants) {
        for (let address of element.returnValues._users) {
          const balance = await this.splitETH.methods
            .groupBalances(element.returnValues._name, address)
            .call();

          friends.push({
            address,
            balance
          });
        }
      }

      const myBal = await this.splitETH.methods
        .groupBalances(element.returnValues._name, this.defaultAccount)
        .call();

      const result2 = await this.splitETH.methods.groupCloseTime(element.returnValues._name).call();

      const name = this.web3.utils.toAscii(element.returnValues._name);

      const timestamp = await this.getTimestampFromBlock(element.blockNumber);

      const groupToAdd = {
        name,
        clanName: cleanAsciiText(name),
        friends,
        timeout: element.returnValues._timeout,
        closed: result2 > 0,
        timestamp,
        myBal
      };

      groups.push(groupToAdd);
    }

    return groups;
  }

  async getTimestampFromBlock(block) {
    return new Promise(resolve => {
      console.log(block, 'asd');
      this.web3.eth.getBlock(block, (error, data) => {
        console.log('getBlock', {
          error,
          data
        });
        resolve(data.timestamp);
      });
    });
  }

  async requestTokensFromFaucet() {
    return await this.seToken.methods
      .getTokens(this.defaultAccount, this.web3.utils.toWei('100000'))
      .send({ from: this.defaultAccount });
  }

  async getTokenBalance(account) {
    if (!account) {
      account = this.defaultAccount;
    }

    const balance = await this.seToken.methods.balanceOf(account).call();

    return this.web3.utils.fromWei(balance);
  }

  async updateAccounts() {
    this.accounts = await this.web3.eth.getAccounts();
  }

  async onTokenBalanceUpdate(callback) {
    await this.waitForInitialization();

    this.seToken_event.events
      .Transfer({ fromBlock: 'latest', toBlock: 'latest' })
      .on('data', async () => {
        const balance = await this.seToken.methods.balanceOf(this.defaultAccount).call();

        const tokenBalance = this.web3.utils.fromWei(balance);

        callback(tokenBalance);
      });
  }

  async setupUpdateGroupCreatedEventsWatch() {
    const fromBlock = this._getCachedGroupCreatedEventsLastFetchedBlock() + 1;

    // console.log('setupUpdate', fromBlock, this.splitETH_event.events);

    this.splitETH_event.events.GroupCreated({ fromBlock, toBlock: 'latest' }).on('data', event => {
      this._addGroupCreatedEventToCache(event);
    });
  }

  _addGroupCreatedEventToCache(event) {
    if (this._groupCreatedEvents.find(({ id }) => id === event.id)) {
      return;
    }

    const GROUP_CREATED_EVENTS_KEY = this._getCachedGroupCreatedEventsKey();
    const GROUP_CREATED_EVENTS_LAST_FETCHED_BLOCK_KEY = this._getCachedGroupCreatedEventsLastFetchedBlockKey();

    this._groupCreatedEvents.push(event);

    window.localStorage.setItem(GROUP_CREATED_EVENTS_KEY, JSON.stringify(this._groupCreatedEvents));

    const lastFetchedBlock = this._getCachedGroupCreatedEventsLastFetchedBlock();

    if (lastFetchedBlock < event.blockNumber) {
      window.localStorage.setItem(GROUP_CREATED_EVENTS_LAST_FETCHED_BLOCK_KEY, event.blockNumber);
    }
  }

  async joinGroup(groupName, user, amount) {
    await this.seToken.methods
      .approve(this.splitETH._address, this.web3.utils.toWei(amount, 'ether'))
      .send({ from: this.defaultAccount });

    await this.splitETH.methods
      .fundUser(groupName, user, this.web3.utils.toWei(amount, 'ether'))
      .send({ from: this.defaultAccount });
  }

  async addNewGroup(groupName, addresses, tokenAddress, expiry) {
    const receipt = await this.splitETH.methods
      .createGroup(groupName, addresses, tokenAddress, expiry)
      .send({ from: this.defaultAccount });

    return receipt;
  }

  async signBill(groupName, bill) {
    return new Promise(resolve => {
      let msgParams = [
        { type: 'address', name: 'splitETH', value: this.splitETH._address },
        { type: 'bytes32', name: 'name', value: groupName },
        { type: 'uint256', name: 'timestamp', value: bill.timestamp }
        // {type: 'uint256', name: 'amount_0', value: 100},
        // {type: 'bool', name: 'isCredit_0', value: false},
        // {type: 'uint256', name: 'amount_1', value: 150},
        // {type: 'bool', name: 'isCredit_1', value: false},
        // {type: 'uint256', name: 'amount_2', value: 250},
        // {type: 'bool', name: 'isCredit_2', value: true},
      ];

      bill.totalBalanceChange.map((entry, index) => {
        const sign = parseInt(entry.value) >= 0;
        const wei = toWei(entry.value).toString();

        console.debug('!!', {
          sign,
          wei
        });

        msgParams.push({
          type: 'uint256',
          name: `amount_${index}`,
          value: wei
        });
        msgParams.push({
          type: 'bool',
          name: `isCredit_${index}`,
          value: sign
        });
      });

      console.debug({
        msgParams
      });

      let from = this.defaultAccount;

      this.web3.currentProvider.sendAsync(
        {
          method: 'eth_signTypedData',
          params: [msgParams, from],
          from: from
        },
        (err, result) => {
          if (err) return console.error(err);
          if (result.error) {
            return console.error(result.error.message);
          }
          let res = result.result.slice(2);
          let r = '0x' + res.substr(0, 64),
            s = '0x' + res.substr(64, 64),
            v = parseInt(res.substr(128, 2), 16);
          console.log(v, r, s);

          resolve({
            from,
            v,
            r,
            s
          });
        }
      );
    });
  }

  async closeGroup(name, lastBillSigned, participants) {
    console.debug('handleCloseChannel', {
      lastBillSigned
    });

    console.log(name);

    const addressMapping = {};

    const vArray = [];
    const rArray = [];
    const sArray = [];
    const weiArray = [];
    const signArray = [];

    lastBillSigned.signatures.map(signature => {
      addressMapping[signature.signer.toLowerCase()] = signature;
    });

    lastBillSigned.totalBalanceChange.map(entry => {
      const sign = parseInt(entry.value) >= 0;
      const wei = toWei(entry.value)
        .absoluteValue()
        .toString();

      console.debug('!!', {
        sign,
        wei
      });

      addressMapping[entry.address.toLowerCase()].wei = wei;
      addressMapping[entry.address.toLowerCase()].sign = sign;
    });

    for (let participant of participants) {
      const entry = addressMapping[participant.address.toLowerCase()];

      vArray.push(entry.v);
      rArray.push(entry.r);
      sArray.push(entry.s);
      weiArray.push(new BigNumber(entry.wei).absoluteValue().toString());
      signArray.push(entry.sign);
    }

    const parameters = [
      this.web3.utils.fromAscii(name),
      weiArray,
      signArray,
      lastBillSigned.timestamp,
      vArray,
      rArray,
      sArray
    ];

    console.log('closeChannel', parameters);

    const receipt = await this.splitETH.methods
      .closeGroup(...parameters)
      .send({ from: this.defaultAccount });

    console.log(receipt);

    return receipt;
  }

  async withdrawFundsFromGroup(group) {
    return await this.splitETH.methods
      .pullFunds(this.web3.utils.fromAscii(group))
      .send({ from: this.defaultAccount });
  }
}

export default new BlockchainServiceClass();
