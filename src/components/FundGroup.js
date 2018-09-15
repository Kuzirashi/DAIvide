import React, { Component } from 'react';
import { Form, FormGroup, Label, Input, Row, Col } from 'reactstrap';
import toastr from 'toastr';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';

class FundGroup extends Component {
  state = {
    accounts: [],
    friends: [{ address: '' }]
  };

  constructor() {
    super();

    this.handleSubmitJoinChannel = this.handleSubmitJoinChannel.bind(this);
  }

  async componentDidMount() {
    const accounts = await this.props.web3.eth.getAccounts();

    this.setState({
      accounts,
      selectedGroup: this.props.match.params.groupName
    });
  }

  render() {
    return (
      <div className="container mt-5">
        <div className="row">
          <div className="col">
            <h3 className="Expenses-Group-title">Add balance</h3>
          </div>
        </div>

        <div className="Wallet Wallet-container">
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
                <button className="btn btn-primary" type="submit">
                  Fund
                </button>
              </Form>
            </Col>
          </Row>
        </div>
      </div>
    );
  }

  async handleSubmitJoinChannel(event) {
    event.preventDefault();

    const groupName = this.props.web3.utils.fromAscii(event.target.GroupName.value);
    const user = event.target.User.value;
    const amount = event.target.Amount.value;

    await this.props.blockchainService.joinGroup(groupName, user, amount);

    this.props.history.push('/');

    toastr.success(`You have successfully joined the group.`);
  }
}

export default inject('blockchainService', 'web3')(observer(withRouter(FundGroup)));
