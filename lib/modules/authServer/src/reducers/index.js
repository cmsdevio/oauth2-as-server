/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import { combineReducers } from 'redux';
import { reducer as formReducer } from 'redux-form';

import AuthReducer from './AuthReducer';
import ClientsReducer from './ClientsReducer';
import UsersReducer from './UsersReducer';

export default combineReducers({
    auth: AuthReducer,
    clients: ClientsReducer,
    users: UsersReducer,
    form: formReducer
});
