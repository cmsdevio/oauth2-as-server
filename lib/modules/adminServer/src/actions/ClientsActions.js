/* eslint-disable import/prefer-default-export */
/**
 * Crafted in Erebor by thorin on 2018-04-02
 */
import axios from 'axios';
import { push } from 'react-router-redux';

import {
    GET_CLIENTS,
    GET_CLIENTS_SUCCESS,
    GET_CLIENTS_FAIL,
    CLIENT_CREATE,
    CLIENT_CREATE_SUCCESS,
    CLIENT_CREATE_FAIL
} from './types';

const baseUrl = process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin';

export const getClients = () => async (dispatch, getState) => {
    const { token } = getState().auth;
    dispatch({ type: GET_CLIENTS });
    try {
        const response = await axios.get(
            `${ baseUrl }/clients`,
            {
                headers: {
                    Authorization: `Bearer ${ token }`
                }
            }
        );
        return dispatch({
            type: GET_CLIENTS_SUCCESS,
            payload: { listClients: response.data.listClients }
        });
    } catch (error) {
        console.error(`Error fetching clients: ${ error }.`);
        return dispatch({ type: GET_CLIENTS_FAIL });
    }
};

export const addClient = clientData => async (dispatch, getState) => {
    const { token } = getState().auth;
    dispatch({ type: CLIENT_CREATE });
    try {
        await axios.post(
            `${ baseUrl }/addClient`,
            clientData,
            {
                headers: {
                    Authorization: `Bearer ${ token }`
                }
            }
        );
        dispatch({ type: CLIENT_CREATE_SUCCESS });
        return dispatch(push('/clients'));
    } catch (error) {
        console.error(`Error creating client: ${ error }.`);
        return dispatch({ type: CLIENT_CREATE_FAIL });
    }
};
