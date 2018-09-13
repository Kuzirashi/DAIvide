import Web3 from 'web3';
import SplitETHJSON from '../build/contracts/SplitETH.json';
import SETokenJSON from '../build/contracts/SEToken.json';
import { NETWORK_ID, ADDRESSES } from './config';
import { cleanAsciiText } from '../components/Expenses';

class BlockchainService {
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
      'wss://rarely-suitable-shark.quiknode.io/87817da9-942d-4275-98c0-4176eee51e1a/aB5gwSfQdN4jmkS65F1HyA==/'
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

    this._initialize();
  }

  async waitForInitialization() {
    return this._initializationPromise;
  }

  async _initialize() {
    await this.updateAccounts();
    await this.updateCurrentBlock();

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

    const lastCacheFetchedBlock =
      window.localStorage.getItem('_groupCreatedEventsLastFetchedBlock') || 0;
    const cachedEvents = window.localStorage.getItem('_groupCreatedEvents');

    if (cachedEvents) {
      this._groupCreatedEvents = JSON.parse(cachedEvents);

      return this._groupCreatedEvents;
    }

    this._groupCreatedEvents = await this.splitETH_event.getPastEvents('GroupCreated', {
      fromBlock: lastCacheFetchedBlock,
      toBlock: 'latest'
    });

    window.localStorage.setItem('_groupCreatedEvents', JSON.stringify(this._groupCreatedEvents));
    window.localStorage.setItem('_groupCreatedEventsLastFetchedBlock', this.currentBlock);

    return this._groupCreatedEvents;
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

      const groupToAdd = {
        name,
        clanName: cleanAsciiText(name),
        friends,
        timeout: element.returnValues._timeout,
        closed: result2 > 0 ? true : false,
        myBal
      };

      groups.push(groupToAdd);
    }

    return groups;
  }

  async requestTokensFromFaucet() {
    return await this.seToken.methods
      .getTokens(this.accounts[0], this.web3.utils.toWei('100000'))
      .send({ from: this.accounts[0] });
  }

  async getTokenBalance(account) {
    await this.waitForInitialization();

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
}

export default new BlockchainService();
