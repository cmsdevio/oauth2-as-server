import React from 'react';
import ReactDOM from 'react-dom';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import createHistory from 'history/createBrowserHistory';
import injectTapEventPlugin from 'react-tap-event-plugin';
import { createStore, compose, applyMiddleware } from 'redux';
import Promise from 'redux-promise';
import ReduxThunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { logger } from 'redux-logger';

import reducers from './reducers';
import Header from './components/Header.component';
import LoginForm from './components/LoginForm';

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin();

const history = createHistory();
const middleware = [ Promise, ReduxThunk, logger ];
const store = createStore(
    reducers,
    undefined,
    compose(applyMiddleware(...middleware))
);

const App = () => (
    <Provider store={store}>
        <MuiThemeProvider>
            <div>
                <Header />
                <LoginForm />
            </div>
        </MuiThemeProvider>
    </Provider>
);

ReactDOM.render(
    <App />,
    document.getElementById('root')
);
