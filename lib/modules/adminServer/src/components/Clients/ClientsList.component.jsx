import React, { Component } from 'react';
import { connect } from 'react-redux';
import CircularProgress from 'material-ui/CircularProgress';

import * as actions from '../../actions';

class ClientsList extends Component {
    componentWillMount() {
        this.props.getClients();
    }

    render() {
        const { loading, error, clients } = this.props;

        if (loading) {
            return <CircularProgress size={80} thickness={5} />;
        }
        if (error) {
            return <div className="alert alert-danger">Oops! Something went wrong...</div>;
        }
        if (clients.length === 0) {
            return <div>No clients found.</div>;
        }

        return (
            <div>TBD: table of clients...</div>
        );
    }
}

const mapStateToProps = state => ({
    loading: state.clients.loading,
    clients: state.clients.listClients,
    error: state.clients.error
});

export default connect(mapStateToProps, actions)(ClientsList);
