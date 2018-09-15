import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import BlockchainService from '../domain/BlockchainService';
import toastr from 'toastr';

class NavBar extends Component {
  state = {
    tokenBalance: 0
  };

  constructor() {
    super();

    this.handleGetTokens = this.handleGetTokens.bind(this);
  }

  async handleGetTokens() {
    await BlockchainService.requestTokensFromFaucet();

    await this.updateTokenBalance();

    toastr.success(`Your tokens balance has been updated.`);
  }

  async updateTokenBalance() {
    const tokenBalance = await BlockchainService.getTokenBalance();

    this.setState({ tokenBalance });
  }

  async componentDidMount() {
    await this.updateTokenBalance();

    BlockchainService.onTokenBalanceUpdate(tokenBalance => {
      this.setState({ tokenBalance });
    });
  }

  render() {
    return (
      <nav className="navbar navbar-expand-md">
        <div className="container relative">
          <div className="row">
            <Link to="/" className="navbar-brand">
              DAIvide
            </Link>
            <button
              className="btn btn-primary dai-button text-right"
              onClick={this.handleGetTokens}
            >
              {' '}
              {this.state.tokenBalance} DAI{' '}
            </button>
          </div>
        </div>
      </nav>
    );
  }
}

export default NavBar;
