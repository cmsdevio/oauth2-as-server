import React, { Component } from 'react';
import { connect } from 'react-redux';

import UserForm from './UserForm.component';
import * as actions from '../../actions';

class AddUser extends Component {
    submit = (values) => {
        console.log(values);
        this.props.addUser({ email: values.email, password: values.password });
    };

    render() {
        const { error } = this.props;

        /*if (loading) {
            return <CircularProgress size={80} thickness={5} />;
        }*/
        if (error) {
            return <div className="alert alert-danger">Oops! Something went wrong...</div>;
        }

        return (
            <div className="container theme-showcase" role="main">
                <div className="page-header">
                    <h1>Add User</h1>
                </div>
                <div className="row">
                    <div className="col-md-12">
                        <UserForm onSubmit={this.submit} />
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.clients.loading,
    error: state.clients.error
});

export default connect(mapStateToProps, actions)(AddUser);
