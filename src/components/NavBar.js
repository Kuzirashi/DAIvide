import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { inject, observer } from 'mobx-react';

class NavBar extends Component {
  render() {
    return (
      <nav className="navbar navbar-expand-md">
        <div className="container relative">
          <div className="row w-100">
            <div className="col-6">
              <Link to="/" className="navbar-brand">
                <b>DAI</b>
                vide
              </Link>
            </div>
            <div className="col-6 text-right dai-row">
              <div className="dai-button">
                <i className="dai-symbol" /> {this.props.blockchainService.tokenBalance.get()} DAI{' '}
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }
}

export default inject('blockchainService')(observer(NavBar));
