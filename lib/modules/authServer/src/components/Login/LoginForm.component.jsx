/**
 * Crafted in Erebor by thorin on 2018-04-16
 */
import React from 'react';
import { Field, reduxForm } from 'redux-form';
import { Button } from 'react-bootstrap';

let LoginForm = (props) => {
    const { handleSubmit, isLoading } = props;
    return (
        <form className="form-horizontal" onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="email" className="col-sm-2 control-label">Email</label>
                <div className="col-sm-10">
                    <Field
                        name="email"
                        component="input"
                        type="email"
                        className="form-control"
                        placeholder="Email"
                    />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="password" className="col-sm-2 control-label">Password</label>
                <div className="col-sm-10">
                    <Field
                        name="password"
                        component="input"
                        type="password"
                        className="form-control"
                        placeholder="Password"
                    />
                </div>
            </div>
            <div className="form-group">
                <div className="col-sm-offset-2 col-sm-10">
                    <Button
                        type="submit"
                        bsStyle="primary"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Login in...' : 'Login'}
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default LoginForm = reduxForm({ form: 'login' })(LoginForm);
