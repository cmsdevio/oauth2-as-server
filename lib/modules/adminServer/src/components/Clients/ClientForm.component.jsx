/**
 * Crafted in Erebor by thorin on 2018-04-16
 */
import React from 'react';
import { Field, reduxForm } from 'redux-form';

let ClientForm = (props) => {
    const { handleSubmit } = props;
    return (
        <form className="form-horizontal" onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="client_name" className="col-sm-2 control-label">Client Name</label>
                <div className="col-sm-10">
                    <Field name="client_name" component="input" type="text" className="form-control" />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="redirect_uri" className="col-sm-2 control-label">Redirect URI</label>
                <div className="col-sm-10">
                    <Field name="redirect_uri" component="input" type="text" className="form-control" />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="scope" className="col-sm-2 control-label">Scope</label>
                <div className="col-sm-10">
                    <Field name="scope" component="input" type="text" className="form-control" />
                </div>
            </div>
            <button type="submit">Submit</button>
        </form>
    );
};

export default ClientForm = reduxForm({ form: 'client' })(ClientForm);
