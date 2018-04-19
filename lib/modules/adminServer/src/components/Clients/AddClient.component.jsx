import React, { Component } from 'react';
import { connect } from 'react-redux';

import ClientForm from './ClientForm.component';
import * as actions from '../../actions';

class AddClient extends Component {
    submit = (values) => {
        console.log(values);
        this.props.addClient(values);
    };

    render() {
        const { loading, error } = this.props;

        /*if (loading) {
            return <CircularProgress size={80} thickness={5} />;
        }*/
        if (error) {
            return <div className="alert alert-danger">Oops! Something went wrong...</div>;
        }

        return (
            <div className="container theme-showcase" role="main">
                <div className="page-header">
                    <h1>Add Client</h1>
                </div>
                <div className="row">
                    <div className="col-md-12">
                        <ClientForm onSubmit={this.submit} />
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

export default connect(mapStateToProps, actions)(AddClient);
