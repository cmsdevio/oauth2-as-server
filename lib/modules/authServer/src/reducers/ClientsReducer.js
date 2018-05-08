/**
 * Crafted in Erebor by thorin on 2018-04-03
 */
import {
    GET_CLIENTS,
    GET_CLIENTS_SUCCESS,
    GET_CLIENTS_FAIL,
    CLIENT_CREATE,
    AS_AUTH_RESET
} from '../actions/types';

const INITIAL_STATE = {
    loading: false,
    listClients: [],
    error: ''
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
    case GET_CLIENTS:
        return { ...state, loading: true };
    case GET_CLIENTS_SUCCESS:
        return { ...state, ...INITIAL_STATE, ...action.payload };
    case GET_CLIENTS_FAIL:
        return { ...state, error: 'Error loading clients.', loading: false };
    case CLIENT_CREATE:
        return { ...state, loading: true };
    case AS_AUTH_RESET:
        return { ...state, ...INITIAL_STATE };
    default:
        return state;
    }
};
