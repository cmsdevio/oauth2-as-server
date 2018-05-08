import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Table } from 'react-bootstrap';

import * as actions from '../../actions';

class ClientsList extends Component {
    componentWillMount() {
        this.props.getClients();
    }

    renderAddClientButton() {
        return (
            <p>
                <Link className="btn btn-large btn-info" to="/addClient">Create Client</Link>
            </p>
        );
    }

    renderTableRow(client) {
        return (
            <tr key={client._id}>
                <td>{client.client_name}</td>
                <td>{client.client_id_created_at}</td>
                <td>{client.grant_type}</td>
                <td>{client.client_id}</td>
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
        const { loading, error, clients } = this.props;

        /*if (loading) {
            return <CircularProgress size={80} thickness={5} />;
        }*/
        if (error) {
            return <div className="alert alert-danger">Oops! Something went wrong...</div>;
        }
        if (clients.length === 0) {
            return (
                <div className="container theme-showcase" role="main">
                    <div className="page-header">
                        <h1>List Clients</h1>
                    </div>
                    <div className="row">
                        <div className="col-md-12">
                            No clients found.
                            {this.renderAddClientButton()}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="container theme-showcase" role="main">
                <div className="page-header">
                    <h1>List Clients</h1>
                </div>
                <div className="row">
                    <div className="col-md-12">
                        <Table striped bordered condensed hover>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Creation Date</th>
                                    <th>Grant Type</th>
                                    <th>Client ID</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(client => this.renderTableRow(client))}
                            </tbody>
                        </Table>
                        {this.renderAddClientButton()}
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.clients.loading,
    clients: state.clients.listClients,
    error: state.clients.error
});

export default connect(mapStateToProps, actions)(ClientsList);
