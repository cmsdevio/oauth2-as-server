/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import {
    AS_LOGIN,
    AS_LOGIN_SUCCESS,
    AS_LOGIN_FAIL
} from '../actions/types';

const INITIAL_STATE = {
    token: null,
    role: '',
    error: '',
    loading: false
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
    case AS_LOGIN:
        return { ...state, loading: true };
    case AS_LOGIN_SUCCESS:
        return {
            ...state,
            ...INITIAL_STATE,
            ...action.payload
        };
    case AS_LOGIN_FAIL:
        return { ...state, error: 'Authentication Failed.', loading: false };
    default:
        return state;
    }
};
