/**
 * Crafted in Erebor by thorin on 2018-04-24
 */
import {
    GET_USERS,
    GET_USERS_SUCCESS,
    GET_USERS_FAIL,
    USER_CREATE,
    USER_CREATE_SUCCESS,
    USER_CREATE_FAIL,
    AS_AUTH_RESET
} from '../actions/types';

const INITIAL_STATE = {
    loading: false,
    listUsers: [],
    error: ''
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
    case GET_USERS:
        return { ...state, loading: true };
    case GET_USERS_SUCCESS:
        return { ...state, ...INITIAL_STATE, ...action.payload };
    case GET_USERS_FAIL:
        return { ...state, error: 'Error loading users.', loading: false };
    case USER_CREATE:
        return { ...state, loading: true };
    case AS_AUTH_RESET:
        return { ...state, ...INITIAL_STATE };
    default:
        return state;
    }
};
