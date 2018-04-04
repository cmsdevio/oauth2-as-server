/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import { combineReducers } from 'redux';

import AuthReducer from './AuthReducer';
import ClientsReducer from './ClientsReducer';

export default combineReducers({
    auth: AuthReducer,
    clients: ClientsReducer
});
