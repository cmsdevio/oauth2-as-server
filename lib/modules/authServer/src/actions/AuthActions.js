/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import { push } from 'react-router-redux';

import { api } from '../main';

import {
    AS_LOGIN,
    AS_LOGIN_SUCCESS,
    AS_LOGIN_FAIL
} from './types';

const baseUrl = process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin';

export const loginUser = data => async (dispatch) => {
    console.log(data);
    console.log(data.email);
    console.log(`${ baseUrl }/login`);
    dispatch({ type: AS_LOGIN });
    try {
        const response = await api.post(
            '/login',
            data
        );
        // TODO: export store and subscribe to get the token
        // or use Redux middleware
        window.token = response.data.token;
        dispatch({ type: AS_LOGIN_SUCCESS, payload: { ...response.data } });
        return dispatch(push('/clients'));
    } catch (error) {
        console.error(`Authentication error: ${ error }.`);
        return dispatch({ type: AS_LOGIN_FAIL });
    }
};
