import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Table } from 'react-bootstrap';

import * as actions from '../../actions';

class UsersList extends Component {
    componentWillMount() {
        this.props.getUsers();
    }

    renderAddUserButton() {
        return (
            <p>
                <Link className="btn btn-large btn-info" to="/addUser">Create User</Link>
            </p>
        );
    }

    renderTableRow(user) {
        return (
            <tr key={user._id}>
                <td>{user.email}</td>
                <td>{user.created_at}</td>
                <td>{user.role}</td>
                <td>
                    <div className="btn-group" role="group" aria-label="...">
                        <button type="button" className="btn btn-default">
                            <span className="glyphicon glyphicon-pencil" />
                        </button>
                        <a
                            className="btn btn-large btn-info"
                            href="#"
                        >
                            <span className="glyphicon glyphicon-remove icon-danger" />
                        </a>
                        <a
                            className="btn btn-large btn-info"
                            href="#"
                        >
                            <span className="glyphicon glyphicon-off icon-success" />
                            {/*<span className="glyphicon glyphicon-off"></span>*/}
                        </a>
                    </div>
                </td>
            </tr>
        );
    }

    render() {
        const { error, users } = this.props;

        if (error) {
            return <div className="alert alert-danger">Oops! Something went wrong...</div>;
        }
        if (users.length === 0) {
            return (
                <div>
                    No users found.
                    {this.renderAddUserButton()}
                </div>
            );
        }

        return (
            <div className="container theme-showcase" role="main">
                <div className="page-header">
                    <h1>List Users</h1>
                </div>
                <div className="row">
                    <div className="col-md-12">
                        <Table striped bordered condensed hover>
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Creation Date</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => this.renderTableRow(user))}
                            </tbody>
                        </Table>
                        {this.renderAddUserButton()}
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.users.loading,
    error: state.users.error,
    users: state.users.listUsers
});

export default connect(mapStateToProps, actions)(UsersList);
