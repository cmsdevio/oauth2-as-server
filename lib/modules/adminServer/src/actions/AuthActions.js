/* eslint-disable import/prefer-default-export */
/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import axios from 'axios';
import { push } from 'react-router-redux';

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
        const response = await axios.post(
            `${ baseUrl }/login`,
            data,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        dispatch({ type: AS_LOGIN_SUCCESS, payload: { ...response.data } });
        return dispatch(push('/clients'));
    } catch (error) {
        console.error(`Authentication error: ${ error }.`);
        return dispatch({ type: AS_LOGIN_FAIL });
    }
};
