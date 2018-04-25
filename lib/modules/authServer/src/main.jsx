import React from 'react';
import ReactDOM from 'react-dom';
import createHistory from 'history/createBrowserHistory';
import { createStore, compose, applyMiddleware } from 'redux';
import { ConnectedRouter, routerMiddleware } from 'react-router-redux';
import { Route } from 'react-router';
import Promise from 'redux-promise';
import ReduxThunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { logger } from 'redux-logger';
import Bootstrap from 'bootstrap/dist/css/bootstrap.css';
import axios from 'axios';

import reducers from './reducers';
import Header from './components/Header.component';
import LoginForm from './components/Login/Login.component';
import ClientsList from './components/Clients/ClientsList.component';
import AddClient from './components/Clients/AddClient.component';
import UsersList from './components/Users/UsersList.component';
import AddUser from './components/Users/AddUser.component';
import { AS_AUTH_RESET } from './actions/types';

const history = createHistory();
const middleware = [ Promise, ReduxThunk, logger ];
const store = createStore(
    reducers,
    undefined,
    compose(applyMiddleware(...middleware, routerMiddleware(history)))
);

// TODO: extract this to its own file -- i.e.: network-utils
// Export store for Axios configuration (token access)
// export default store;
const select = state => state.auth.token;

const handleStoreChanges = () => {
    const token = select(store.getState());
    axios.defaults.headers.common.Authorization = `Bearer ${ token }`;
};
store.subscribe(handleStoreChanges);
axios.interceptors.response.use((response) => {
    // Do something with response data
    return response;
}, (error) => {
    // Do something with response error
    if (error.response.data.message === 'Bad token' &&
        error.response.data.statusCode === 401) {
        store.dispatch({ type: AS_AUTH_RESET });
    }
    return error;
});

module.exports.api = axios.create({
    baseURL: process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin'
});

const App = () => (
    <Provider store={store}>
        <ConnectedRouter history={history}>
            <div>
                <Header />
                <Route exact path="/" component={LoginForm} />
                <Route path="/clients" component={ClientsList} />
                <Route path="/addClient" component={AddClient} />
                <Route path="/users" component={UsersList} />
                <Route path="/addUser" component={AddUser} />
            </div>
        </ConnectedRouter>
    </Provider>
);

ReactDOM.render(
    <App />,
    document.getElementById('root')
);
