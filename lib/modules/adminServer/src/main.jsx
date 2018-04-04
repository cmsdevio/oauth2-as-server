import React from 'react';
import ReactDOM from 'react-dom';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import createHistory from 'history/createBrowserHistory';
import injectTapEventPlugin from 'react-tap-event-plugin';
import { createStore, compose, applyMiddleware } from 'redux';
import { ConnectedRouter, routerMiddleware } from 'react-router-redux';
import { Route } from 'react-router';
import Promise from 'redux-promise';
import ReduxThunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { logger } from 'redux-logger';

import reducers from './reducers';
import Header from './components/Header.component';
import LoginForm from './components/LoginForm';
import ClientsList from './components/Clients/ClientsList.component';

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin();

const history = createHistory();
const middleware = [ Promise, ReduxThunk, logger ];
const store = createStore(
    reducers,
    undefined,
    compose(applyMiddleware(...middleware, routerMiddleware(history)))
);

const App = () => (
    <Provider store={store}>
        <MuiThemeProvider>
            <ConnectedRouter history={history}>
                <div>
                    <Header />
                    <Route exact path="/" component={LoginForm} />
                    <Route path="/clients" component={ClientsList} />
                </div>
            </ConnectedRouter>
        </MuiThemeProvider>
    </Provider>
);

ReactDOM.render(
    <App />,
    document.getElementById('root')
);
