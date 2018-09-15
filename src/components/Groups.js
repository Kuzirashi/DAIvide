import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import SplitETHJSON from '../build/contracts/SplitETH.json';
import { Row, Col } from 'reactstrap';
import { Button, Form, FormGroup, Label, Input } from 'reactstrap';
import $ from 'jquery';
import toastr from 'toastr';
import { cleanAsciiText, toWei } from './Expenses';
import BlockchainService from '../domain/BlockchainService';

import { Link } from 'react-router-dom';
import SETokenJSON from '../build/contracts/SEToken.json';
import { API_HOST } from './Expenses';
import { ADDRESSES } from '../domain/config';

const SELECTED_OPTION = {
  ADD_GROUP: 1,
  ADD_BALANCE: 2
};

class Groups extends Component {
  constructor(props) {
    super(props);

    this.showAddGroupView = this.showAddGroupView.bind(this);
    this.handleJoinChannel = this.handleJoinChannel.bind(this);
    this.handleCloseChannel = this.handleCloseChannel.bind(this);
    this.handleSubmitNewChannel = this.handleSubmitNewChannel.bind(this);
    this.handleSubmitJoinChannel = this.handleSubmitJoinChannel.bind(this);
    this.handlePullFundsFromChannel = this.handlePullFundsFromChannel.bind(this);

    const splitETHAddress = ADDRESSES.SPLITTER;
    const splitETHABI = SplitETHJSON.abi;

    const SETAddress = ADDRESSES.TOKEN;
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

    const groupName = this.state.web3.utils.fromAscii(event.target.GroupName.value);
    const addresses = [];
    this.state.friends.forEach(element => {
      addresses.push(element.address);
    });

    const tokenAddress = event.target.TokenAddress.value;
    const expiry = event.target.Expiry.value;

    const receipt = await this.state.splitETH.methods
      .createGroup(groupName, addresses, tokenAddress, expiry)
      .send({ from: this.state.accounts[0] });

    const name = this.state.web3.utils.toAscii(receipt.events.GroupCreated.returnValues._name);
    const message = `Group "${name}" successfully created!`;

    toastr.success(message);

    this.setState({ selectedOption: 0 });
    this.getGroups();

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
    event.preventDefault();

    const groupName = this.state.web3.utils.fromAscii(event.target.GroupName.value);
    const user = event.target.User.value;
    const amount = event.target.Amount.value;

    await BlockchainService.joinGroup(groupName, user, amount);

    this.setState({ selectedOption: 0 });
    await this.getGroups();

    toastr.success(`You have successfully joined the group.`);
  }

  async showAddGroupView(event) {
    event.preventDefault();

    this.setState({ selectedOption: SELECTED_OPTION.ADD_GROUP });
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
              Create new group
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
                    <Input type="text" name="GroupName" placeholder="Name" />
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
                    <button className="btn btn-primary" disabled={this.state.friends.length < 2}>
                      Submit
                    </button>
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
        <i className="material-icons">close</i>
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
      <div className="Groups w-100">
        {this.state.groups.map((group, groupIndex) => (
          <div className="Group-single" key={groupIndex}>
            <h4 className="Group-single-title">{group.name}</h4>
            <div className="mt-4 Group-single-subtitle">
              You have locked:{' '}
              <span className="badge badge-primary">
                {this.getBalanceLockedInGroup(group, this.defaultAccount)} DAI
              </span>
              <br />
            </div>
            <div className="row text-center d-flex margin-auto Group-actions mt-4">
              {group.closed ? (
                <span>Group is closed</span>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => this.handleJoinChannel(group.name)}
                >
                  <i className="material-icons">attach_money</i>
                  Add Balance
                </button>
              )}
              <Link to={'/expenses/' + group.name} className="btn btn-primary">
                <i className="material-icons">receipt</i>
                Expenses
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
      <div className="NewChannel-Container container">
        <div className="row">
          <div className="widget-alert mb-5 w-100">
            <div className="widget-alert__icon">
              <i className="material-icons">info_outline</i>
            </div>
            <div className="widget-alert__text">
              Please use Kovan network and note this is an alpha version.
            </div>
          </div>

          {this.renderGroupList()}

          <div className="text-right mt-20px">
            <button className="btn btn-primary" onClick={this.showAddGroupView}>
              Create new group
            </button>
          </div>

          {this.renderSelectedOption()}
        </div>
      </div>
    );
  }
}

export default Groups;
