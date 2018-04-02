/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import {
    AS_LOGIN,
    AS_LOGIN_SUCCESS,
    AS_LOGIN_FAIL,
    EMAIL_CHANGED,
    PASSWORD_CHANGED
} from '../actions/types';

const INITIAL_STATE = {
    token: null,
    email: '',
    password: '',
    error: '',
    loading: false
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
    case AS_LOGIN:
        return { ...state, loading: true };
    case AS_LOGIN_SUCCESS:
        return { ...state, ...INITIAL_STATE, token: action.payload };
    case AS_LOGIN_FAIL:
        return { ...state, error: 'Authentication Failed.', loading: false };
    case EMAIL_CHANGED:
        return { ...state, email: action.payload };
    case PASSWORD_CHANGED:
        return { ...state, password: action.payload };
    default:
        return state;
    }
};
