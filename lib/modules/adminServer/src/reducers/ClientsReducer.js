/**
 * Crafted in Erebor by thorin on 2018-04-03
 */
import {
    GET_CLIENTS,
    GET_CLIENTS_SUCCESS,
    GET_CLIENTS_FAIL
} from '../actions/types';

const INITIAL_STATE = {
    loading: false,
    clientsList: [],
    error: ''
};

export default (state = INITIAL_STATE, action) => {
    switch (action.type) {
    case GET_CLIENTS:
        return { ...state, loading: true };
    case GET_CLIENTS_SUCCESS:
        return { ...state, ...INITIAL_STATE, clientsList: action.payload };
    case GET_CLIENTS_FAIL:
        return { ...state, error: 'Error loading clients.', loading: false };
    default:
        return state;
    }
};
