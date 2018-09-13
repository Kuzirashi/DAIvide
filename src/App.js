import React, { Component } from 'react';
import './App.css';

import { HashRouter as Router, Route } from 'react-router-dom';

import Groups from './components/Groups';
import NavBar from './components/NavBar';
import Wallet from './components/Wallet';
import Expenses from './components/Expenses';
import BlockchainService from './domain/BlockchainService';

const About = () => (
  <div>
    <h2>About</h2>
  </div>
);

class App extends Component {
  constructor(props) {
    super(props);

    console.log('set state', {
      web3: BlockchainService.web3
    });

    this.state = {
      web3: BlockchainService.web3,
      web3WH: BlockchainService.web3WH,
      accounts: ''
    };
  }

  render() {
    return (
      <div className="App">
        <Router>
          <div>
            <div>
              <NavBar web3={this.state.web3} web3WH={this.state.web3WH} />
            </div>

            <Route
              exact
              path="/"
              render={() => <Groups web3={this.state.web3} web3WH={this.state.web3WH} />}
            />
            <Route path="/about" component={About} />
            <Route
              path="/expenses/:channelID"
              render={props => (
                <Expenses web3={this.state.web3} web3WH={this.state.web3WH} match={props.match} />
              )}
            />

            <Route
              path="/wallet"
              render={() => <Wallet web3={this.state.web3} web3WH={this.state.web3WH} />}
            />
          </div>
        </Router>
      </div>
    );
  }
}

export default App;
