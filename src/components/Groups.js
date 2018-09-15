import React, { Component } from 'react';
import $ from 'jquery';
import toastr from 'toastr';
import { cleanAsciiText } from './Expenses';
import { observer, inject } from 'mobx-react';
import { Link } from 'react-router-dom';
import { API_HOST } from './Expenses';

class Groups extends Component {
  constructor(props) {
    super(props);

    this.handleGetTokens = this.handleGetTokens.bind(this);
    this.handleCloseChannel = this.handleCloseChannel.bind(this);
    this.handlePullFundsFromChannel = this.handlePullFundsFromChannel.bind(this);

    this.state = {
      web3: props.web3,
      web3WH: props.web3WH,
      name: '',
      groups: []
    };
  }

  async componentDidMount() {
    const accounts = await this.state.web3.eth.getAccounts();

    this.setState({ accounts });

    this.getGroups();
  }

  async handleGetTokens() {
    await this.props.blockchainService.requestTokensFromFaucet();

    toastr.success(`Your tokens balance has been updated.`);
  }

  async getGroups() {
    this.setState({
      groups: []
    });

    const groups = await this.props.blockchainService.getGroups();

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

    const lastBillSigned = await this.getLastBillSigned(group.name);

    await this.props.blockchainService.closeGroup(group.name, lastBillSigned, group.friends);

    await this.getGroups();
  }

  async handlePullFundsFromChannel(group) {
    await this.props.blockchainService.withdrawFundsFromGroup(group);

    await this.getGroups();
  }

  getWithdrawButton(group) {
    if (group.closed) {
      console.debug('group my bla', group, group.myBal, group.myBal === 0);
      if ([0, '0'].includes(group.myBal)) {
        return <span style={{ display: 'none' }}>Balance pulled</span>;
      }

      return (
        <button
          className="btn btn-primary alt"
          onClick={() => this.handlePullFundsFromChannel(group.name)}
        >
          <i className="material-icons">money</i>
          Pull Funds
        </button>
      );
    }
  }

  getCloseButton(group) {
    if (group.closed) {
      return;
    }

    return (
      <button className="btn btn-danger alt" onClick={() => this.handleCloseChannel(group)}>
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
              {group.closed ? (
                <span>Group is closed</span>
              ) : (
                <span>
                  You have locked:{' '}
                  <span className="badge badge-primary">
                    {this.getBalanceLockedInGroup(group, this.defaultAccount)} DAI
                  </span>
                  <br />
                </span>
              )}
            </div>

            <div className="row text-center d-flex margin-auto Group-actions mt-4">
              {this.getWithdrawButton(group)}

              {!group.closed && (
                <Link to={`/fund-group/${group.name}`} className="btn btn-primary alt">
                  <i className="material-icons">attach_money</i>
                  Add Balance
                </Link>
              )}
              <Link to={'/expenses/' + group.name} className="btn btn-primary alt">
                <i className="material-icons">receipt</i>
                Expenses
              </Link>

              {this.getCloseButton(group)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  render() {
    return (
      <div className="NewChannel-Container container">
        {this.props.blockchainService.initialized.get() &&
          [0, '0'].includes(this.props.blockchainService.tokenBalance.get()) && (
            <div className="row">
              <div className="col">
                <div className="widget-alert w-100">
                  <div className="widget-alert__icon">
                    <i className="material-icons">info_outline</i>
                  </div>
                  <div className="widget-alert__text">
                    You don&#39;t have enough DAI to use application.
                  </div>
                  <div className="widget-alert__action" onClick={this.handleGetTokens}>
                    GET TOKENS
                  </div>
                </div>
              </div>
            </div>
          )}

        {this.renderGroupList()}

        <div className="row">
          <div className="col">
            <div className="mt-20px pb-5">
              <Link to="/add-group" className="btn btn-primary">
                Create new group
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default inject('blockchainService')(observer(Groups));
