import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import SplitETHJSON from '../build/contracts/SplitETH.json';
import { Row, Col } from 'reactstrap';
import { Button, Form, FormGroup, Label, Input } from 'reactstrap';
import $ from 'jquery';
import { cleanAsciiText, toWei } from './Expenses';
import BlockchainService from '../domain/BlockchainService';

import { Link } from 'react-router-dom';
import SETokenJSON from '../build/contracts/SEToken.json';
import { API_HOST } from './Expenses';
import { NETWORK_ID } from '../domain/config';

const SELECTED_OPTION = {
  ADD_GROUP: 1,
  ADD_BALANCE: 2
};

class Groups extends Component {
  constructor(props) {
    super(props);

    this.handleNewChannel = this.handleNewChannel.bind(this);
    this.handleJoinChannel = this.handleJoinChannel.bind(this);
    this.handleCloseChannel = this.handleCloseChannel.bind(this);
    this.handleSubmitNewChannel = this.handleSubmitNewChannel.bind(this);
    this.handleSubmitJoinChannel = this.handleSubmitJoinChannel.bind(this);
    this.handlePullFundsFromChannel = this.handlePullFundsFromChannel.bind(this);

    const splitETHAddress = SplitETHJSON.networks[NETWORK_ID].address;
    const splitETHABI = SplitETHJSON.abi;

    const SETAddress = SETokenJSON.networks[NETWORK_ID].address;
    const SETABI = SETokenJSON.abi;

    const splitETH = new props.web3.eth.Contract(splitETHABI, splitETHAddress);
    const splitETH_event = new props.web3WH.eth.Contract(splitETHABI, splitETHAddress);
    splitETH_event.setProvider(props.web3WH.currentProvider);

    const seToken = new props.web3.eth.Contract(SETABI, SETAddress);
    const seToken_event = new props.web3WH.eth.Contract(SETABI, SETAddress);
    seToken_event.setProvider(props.web3WH.currentProvider);

    this.state = {
      web3: props.web3,
      web3WH: props.web3WH,
      splitETH: splitETH,
      splitETH_event: splitETH_event,
      seToken: seToken,
      myValue: 0,
      selectedOption: 0,
      name: '',
      friends: [{ address: '' }],
      groups: []
    };
  }

  async componentDidMount() {
    const accounts = await this.state.web3.eth.getAccounts();

    this.setState({ accounts });

    this.getGroups();
  }

  async handleSubmitNewChannel(event) {
    console.log(event.target.GroupName.value);
    event.preventDefault();

    var _this = this;

    var groupName = this.state.web3.utils.fromAscii(event.target.GroupName.value);
    var addresses = [];
    this.state.friends.forEach(function(element) {
      addresses.push(element.address);
    });
    var tokenAddress = event.target.TokenAddress.value;
    var expiry = event.target.Expiry.value;

    const receipt = await this.state.splitETH.methods
      .createGroup(groupName, addresses, tokenAddress, expiry)
      .send({ from: this.state.accounts[0] });

    //console.log(web3.utils.toAscii(receipt.events.GroupCreated.returnValues._name));
    alert(
      _this.state.web3.utils.toAscii(receipt.events.GroupCreated.returnValues._name) +
        ' Successfully created!'
    );
    _this.setState({ selectedOption: 0 });
    _this.getGroups();

    await this.postGroupToAPI(groupName, addresses.length);

    // receipt can also be a new contract instance, when coming from a "contract.deploy({...}).send()"
  }

  async postGroupToAPI(groupName, participantsAmount) {
    return new Promise(resolve => {
      $.post(
        `${API_HOST}/group`,
        {
          name: window.web3.toUtf8(groupName),
          numParticipants: participantsAmount
        },
        data => {
          console.log('data callback for postGroupToAPI', data);

          resolve(data);
        }
      );
    });
  }

  async handleSubmitJoinChannel(event) {
    //console.log(event.target.GroupName.value);
    event.preventDefault();

    var _this = this;

    var groupName = this.state.web3.utils.fromAscii(event.target.GroupName.value);
    var user = event.target.User.value;
    var amount = event.target.Amount.value;

    await this.state.seToken.methods
      .approve(this.state.splitETH._address, _this.state.web3.utils.toWei(amount, 'ether'))
      .send({ from: this.state.accounts[0] })
      .then(function() {
        _this.state.splitETH.methods
          .fundUser(groupName, user, _this.state.web3.utils.toWei(amount, 'ether'))
          .send({ from: _this.state.accounts[0] })
          .then(function() {
            _this.setState({ selectedOption: 0 });
            _this.getGroups();
          });
      });
  }

  async handleNewChannel(event) {
    //console.log(event.target.myValueInput.value);
    event.preventDefault();
    this.setState({ selectedOption: 1 });
  }

  async handleJoinChannel(group) {
    console.log(group);
    //event.preventDefault();
    this.setState({
      selectedOption: 2,
      selectedGroup: group
    });
  }

  async getGroups() {
    this.setState({
      groups: []
    });

    const groups = await BlockchainService.getGroups();

    this.setState({ groups });
  }

  async getLastBillSigned(groupName) {
    return new Promise(resolve => {
      console.debug('before get', groupName);
      const stringifiedName = cleanAsciiText(groupName);
      console.debug(stringifiedName);
      $.get(`${API_HOST}/group/${stringifiedName}/last-bill-signed`, data => {
        console.log('data callback for postGroupToAPI', data);

        resolve(data);
      });
    });
  }

  async handleCloseChannel(group) {
    console.debug('handleClosechannel', group);

    const lastBillSigned = await this.getLastBillSigned(group);

    console.debug('handleCloseChannel', {
      lastBillSigned
    });

    console.log(group);
    var _this = this;

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
      const wei = toWei(entry.value).toString();

      console.debug('!!', {
        sign,
        wei
      });

      addressMapping[entry.address.toLowerCase()].wei = wei;
      addressMapping[entry.address.toLowerCase()].sign = sign;
    });

    for (let address of Object.keys(addressMapping)) {
      const entry = addressMapping[address];

      vArray.push(entry.v);
      rArray.push(entry.r);
      sArray.push(entry.s);
      weiArray.push(new BigNumber(entry.wei).absoluteValue().toString());
      signArray.push(entry.sign);
    }

    const parameters = [
      this.state.web3.utils.fromAscii(group),
      weiArray,
      signArray,
      lastBillSigned.timestamp,
      vArray,
      rArray,
      sArray
    ];

    console.log('closeChannel', parameters);

    await this.state.splitETH.methods
      .closeGroup(...parameters)
      .send({ from: this.state.accounts[0] })
      .then(function(receipt) {
        console.log(receipt);
        _this.getGroups();
      });
  }

  async handlePullFundsFromChannel(group) {
    console.log(group);
    var _this = this;
    await this.state.splitETH.methods
      .pullFunds(this.state.web3.utils.fromAscii(group))
      .send({ from: this.state.accounts[0] })
      .then(function(receipt) {
        console.log(receipt);
        _this.getGroups();
      });
  }

  renderSelectedOption() {
    if (this.state.selectedOption === SELECTED_OPTION.ADD_GROUP) {
      return (
        <div className="Wallet Wallet-container container">
          <Row>
            <Col sm="12" md={{ size: 8, offset: 2 }}>
              {/* {this.state.accounts[0]} (<EthBalanceDisplay web3={this.state.web3} web3WH={this.state.web3WH} />) */}
            </Col>
          </Row>
          <Row>
            <Col sm="12" md={{ size: 8, offset: 2 }}>
              Create New Channel
            </Col>
          </Row>
          <Row>
            <Col sm="12">
              <Form onSubmit={this.handleSubmitNewChannel}>
                <FormGroup row>
                  <Label for="GroupName" sm={2}>
                    Group Name:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input type="text" name="GroupName" placeholder="My new group" />
                  </Col>
                </FormGroup>

                {this.state.friends.map((friend, idx) => (
                  <div key={idx}>
                    <FormGroup row>
                      <Col sm={10}>
                        <Input
                          type="text"
                          placeholder={`Friend #${idx + 1} ETH address`}
                          value={friend.address}
                          onChange={this.handleFriendNameChange(idx)}
                        />
                      </Col>
                      <Col sm={2}>
                        <Button
                          type="button"
                          onClick={this.handleRemoveFriend(idx)}
                          className="small"
                        >
                          -
                        </Button>
                      </Col>
                    </FormGroup>
                  </div>
                ))}
                <FormGroup row>
                  <Button type="button" onClick={this.handleAddFriend} className="small">
                    Add Friend
                  </Button>
                </FormGroup>

                <FormGroup row>
                  <Label for="TokenAddress" sm={2}>
                    DAI Token Address:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input
                      type="text"
                      name="TokenAddress"
                      placeholder="0xabcdef"
                      disabled
                      value={this.state.seToken._address}
                    />
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label for="Expiry" sm={2}>
                    Expiry Date:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input type="text" name="Expiry" placeholder="12345678" />
                  </Col>
                </FormGroup>
                <FormGroup check row>
                  <Col sm={{ size: 12, offset: 0 }}>
                    <Button>Create new Channel</Button>
                  </Col>
                </FormGroup>
              </Form>
            </Col>
          </Row>
        </div>
      );
    } else if (this.state.selectedOption === SELECTED_OPTION.ADD_BALANCE) {
      return (
        <div className="container Wallet Wallet-container">
          <Row>
            <Col sm="12" md={{ size: 8, offset: 2 }}>
              Fund Group
            </Col>
          </Row>
          <Row>
            <Col sm="12">
              <Form onSubmit={this.handleSubmitJoinChannel}>
                <FormGroup row>
                  <Label for="GroupName" sm={2}>
                    Group:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input
                      type="text"
                      disabled
                      name="GroupName"
                      placeholder="Berlin"
                      value={this.state.selectedGroup}
                    />
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label for="User" sm={2}>
                    User:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input
                      type="text"
                      name="User"
                      placeholder="0x123"
                      disabled
                      value={this.state.accounts[0]}
                    />
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label for="Amount" sm={2}>
                    DAI Amount:{' '}
                  </Label>
                  <Col sm={10}>
                    <Input type="text" name="Amount" placeholder="125" />
                  </Col>
                </FormGroup>
                <FormGroup check row>
                  <Col sm={{ size: 12, offset: 0 }}>
                    <Button>Fund</Button>
                  </Col>
                </FormGroup>
              </Form>
            </Col>
          </Row>
        </div>
      );
    }
  }

  handleFriendNameChange = idx => evt => {
    const newFriends = this.state.friends.map((friend, sidx) => {
      if (idx !== sidx) return friend;
      return { ...friend, address: evt.target.value };
    });

    this.setState({ friends: newFriends });
  };

  handleAddFriend = () => {
    this.setState({
      friends: this.state.friends.concat([{ address: '' }])
    });
  };

  handleRemoveFriend = idx => () => {
    this.setState({
      friends: this.state.friends.filter((s, sidx) => idx !== sidx)
    });
  };

  _getActions(group) {
    if (group.closed) {
      if (group.myBal === 0) {
        return <span>Balance pulled</span>;
      }

      return (
        <button
          className="btn btn-info"
          onClick={() => this.handlePullFundsFromChannel(group.name)}
        >
          Pull Funds
        </button>
      );
    }

    return (
      <button className="btn btn-danger" onClick={() => this.handleCloseChannel(group.name)}>
        Close
      </button>
    );
  }

  get defaultAccount() {
    return this.state.accounts && this.state.accounts[0];
  }

  getBalanceLockedInGroup(group, addressToCheck) {
    console.log({
      friends: group.friends,
      addressToCheck
    });

    const entry = group.friends.find(
      entry => entry.address.toLowerCase() === addressToCheck.toLowerCase()
    );

    if (entry) {
      return this.state.web3.utils.fromWei(entry.balance, 'ether');
    }

    return 0;
  }

  renderGroupList() {
    return (
      <div className="Groups">
        {this.state.groups.map((group, groupIndex) => (
          <div className="Group-single" key={groupIndex}>
            <h4>{group.name}</h4>
            <div className="mt-4">
              You have locked: {this.getBalanceLockedInGroup(group, this.defaultAccount)} DAI <br />
            </div>
            <div className="row text-center d-flex margin-auto Group-actions mt-4">
              {group.closed ? (
                <span>Group is closed</span>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => this.handleJoinChannel(group.name)}
                >
                  Add Balance
                </button>
              )}
              <Link to={'/expenses/' + group.name} className="btn btn-primary">
                Manage
              </Link>
              {this._getActions(group)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  render() {
    return (
      <div className="NewChannel-Container">
        {this.renderGroupList()}

        <div className="text-right mt-5">
          <button className="btn btn-primary" onClick={this.handleNewChannel}>
            Create new group
          </button>
        </div>

        {this.renderSelectedOption()}
      </div>
    );
  }
}

export default Groups;
