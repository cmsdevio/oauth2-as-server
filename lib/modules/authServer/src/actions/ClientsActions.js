/**
 * Crafted in Erebor by thorin on 2018-04-02
 */
import { push } from 'react-router-redux';

import { api } from '../main';

import {
    GET_CLIENTS,
    GET_CLIENTS_SUCCESS,
    GET_CLIENTS_FAIL,
    CLIENT_CREATE,
    CLIENT_CREATE_SUCCESS,
    CLIENT_CREATE_FAIL
} from './types';

export const getClients = () => async (dispatch) => {
    dispatch({ type: GET_CLIENTS });
    try {
        const response = await api.get('/clients');
        return dispatch({
            type: GET_CLIENTS_SUCCESS,
            payload: { listClients: response.data.listClients }
        });
    } catch (error) {
        console.error(`Error fetching clients: ${ error }.`);
        return dispatch({ type: GET_CLIENTS_FAIL });
    }
};

export const addClient = clientData => async (dispatch) => {
    dispatch({ type: CLIENT_CREATE });
    try {
        await api.post('/addClient', clientData);
        dispatch({ type: CLIENT_CREATE_SUCCESS });
        return dispatch(push('/clients'));
    } catch (error) {
        console.error(`Error creating client: ${ error }.`);
        return dispatch({ type: CLIENT_CREATE_FAIL });
    }
};
