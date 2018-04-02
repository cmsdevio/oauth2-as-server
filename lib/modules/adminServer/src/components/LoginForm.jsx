import React, { Component } from 'react';
import { connect } from 'react-redux';
import TextField from 'material-ui/TextField';
// import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import CircularProgress from 'material-ui/CircularProgress';

import * as actions from '../actions';

const styles = {
    margin: 15
};

class LoginForm extends Component {
    onButtonPressed = () => {
        console.log('Login button pressed...');
    };

    renderButton = () => {
        if (this.props.loading) {
            return <CircularProgress />;
        }
        return (
            <FlatButton
                label="Login"
                styles={styles}
                onClick={() => this.onButtonPressed()}
            />
        );
    };

    render() {
        return (
            <div>
                <TextField
                    hintText="email@gmail.com"
                    floatingLabelText="Email"
                    onChange={(event, newValue) => this.props.emailChanged(newValue)}
                />
                <br />
                <TextField
                    type="password"
                    hintText="password"
                    floatingLabelText="Password"
                    onChange={(event, newValue) => this.props.passwordChanged(newValue)}
                />
                <br />
                {this.renderButton()}
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.auth.loading
});

export default connect(mapStateToProps, actions)(LoginForm);
