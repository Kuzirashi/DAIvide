import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import BlockchainService from '../domain/BlockchainService';

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
      <div>
        <nav className="navbar navbar-expand-md">
          <Link to="/" className="navbar-brand">
            DAIvide
          </Link>
          <button className="btn dai-button text-right" onClick={this.handleGetTokens}>
            {' '}
            {this.state.tokenBalance} DAI{' '}
          </button>
        </nav>
      </div>
    );
  }
}

export default NavBar;
