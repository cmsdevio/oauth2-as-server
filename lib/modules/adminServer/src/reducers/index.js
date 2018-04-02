/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import { combineReducers } from 'redux';

import AuthReducer from './AuthReducer';

export default combineReducers({
    auth: AuthReducer,
    collections: () => []
});
