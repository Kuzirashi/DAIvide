import React, { Component } from 'react';

import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  Button
} from 'reactstrap';

import SETokenJSON from '../build/contracts/SEToken.json';
import { NETWORK_ID } from './Channel';

class NavBar extends Component {
  constructor(props) {
    super(props);

    const SETAddress = SETokenJSON.networks[NETWORK_ID].address;
    const SETABI = SETokenJSON.abi;

    const seToken = new props.web3.eth.Contract(SETABI, SETAddress);
    const seToken_event = new props.web3WH.eth.Contract(SETABI, SETAddress);
    seToken_event.setProvider(props.web3WH.currentProvider);

    this.state = {
      web3: props.web3,
      web3WH: props.web3WH,
      seToken: seToken,
      seToken_event: seToken_event
    };

    this.handleGetTokens = this.handleGetTokens.bind(this);
  }

  async componentDidMount() {
    var _this = this;

    var accounts;
    this.state.web3.eth.getAccounts().then(res => {
      accounts = res;
      this.setState({ accounts: accounts });
      this.state.seToken.methods
        .balanceOf(this.state.accounts[0])
        .call()
        .then(function(res) {
          _this.setState({ tokenBalance: _this.state.web3.utils.fromWei(res) });
        });
    });

    this.state.seToken_event.events
      .Transfer({ fromBlock: 'latest', toBlock: 'latest' })
      .on('data', () => {
        //console.log("QQQ",event.returnValues._message);
        _this.state.seToken.methods
          .balanceOf(_this.state.accounts[0])
          .call()
          .then(function(res) {
            _this.setState({ tokenBalance: _this.state.web3.utils.fromWei(res) });
          });
      });
  }

  async handleGetTokens() {
    var _this = this;
    await this.state.seToken.methods
      .getTokens(this.state.accounts[0], this.state.web3.utils.toWei('100000'))
      .send({ from: this.state.accounts[0] })
      .then(function() {
        _this.state.seToken.methods
          .balanceOf(_this.state.accounts[0])
          .call()
          .then(function(res) {
            _this.setState({ tokenBalance: _this.state.web3.utils.fromWei(res) });
          });
      });
  }

  render() {
    return (
      <div>
        <Navbar color="light" light expand="md">
          <NavbarBrand href="/">DAIvide</NavbarBrand>
          <NavbarToggler onClick={this.toggle} />
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav className="ml-auto" navbar>
              <NavItem>
                <NavLink>
                  <Button href="" onClick={() => this.handleGetTokens()}>
                    {' '}
                    {this.state.tokenBalance} DAI{' '}
                  </Button>
                </NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
      </div>
    );
  }
}

export default NavBar;
