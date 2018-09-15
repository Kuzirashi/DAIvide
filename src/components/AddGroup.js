import React, { Component } from 'react';
import { Button, Form, FormGroup, Label, Input, Row, Col } from 'reactstrap';
import { ADDRESSES } from '../domain/config';
import toastr from 'toastr';
import $ from 'jquery';
import { API_HOST } from './Expenses';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';

class AddGroup extends Component {
  state = {
    friends: [{ address: '' }]
  };

  constructor() {
    super();

    this.handleSubmitNewChannel = this.handleSubmitNewChannel.bind(this);
  }

  render() {
    return (
      <div className="container mt-5">
        <div className="row">
          <div className="col">
            <h3 className="Expenses-Group-title">Create new group</h3>
          </div>
        </div>
        <div className="Wallet Wallet-container">
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
                      value={ADDRESSES.TOKEN}
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
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={this.state.friends.length < 2}
                >
                  SUBMIT
                </button>
              </Form>
            </Col>
          </Row>
        </div>
      </div>
    );
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

  async handleSubmitNewChannel(event) {
    event.preventDefault();

    const groupName = this.props.web3.utils.fromAscii(event.target.GroupName.value);
    const addresses = [];
    this.state.friends.forEach(element => {
      addresses.push(element.address);
    });

    const tokenAddress = event.target.TokenAddress.value;
    const expiry = event.target.Expiry.value;

    const receipt = await this.props.blockchainService.addNewGroup(
      groupName,
      addresses,
      tokenAddress,
      expiry
    );

    const name = this.props.web3.utils.toAscii(receipt.events.GroupCreated.returnValues._name);
    const message = `Group "${name}" successfully created!`;

    toastr.success(message);

    await this.postGroupToAPI(groupName, addresses.length);

    this.props.history.push('/');
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
}

export default inject('blockchainService', 'web3')(observer(withRouter(AddGroup)));
