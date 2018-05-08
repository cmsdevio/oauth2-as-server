import React, { Component } from 'react';
import { connect } from 'react-redux';

import * as actions from '../../actions/index';
import LoginForm from './LoginForm.component';

class LoginComponent extends Component {
    submit = (values) => {
        this.props.loginUser(values);
    };

    render() {
        return (
            <div className="container theme-showcase" role="main">
                <div className="page-header">
                    <h1>Login</h1>
                </div>
                <div className="row">
                    <div className="col-md-12">
                        <LoginForm onSubmit={this.submit} isLoading={this.props.loading} />
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.auth.loading
});

export default connect(mapStateToProps, actions)(LoginComponent);
