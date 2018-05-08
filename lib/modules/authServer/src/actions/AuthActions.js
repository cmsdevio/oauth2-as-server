/**
 * Crafted in Erebor by thorin on 2018-03-30
 */
import { push } from 'react-router-redux';

import api from '../common/api';
import hash from '../common/hash';
import {
    AS_LOGIN,
    AS_LOGIN_SUCCESS,
    AS_LOGIN_FAIL
} from './types';

export const loginUser = data => async (dispatch) => {
    dispatch({ type: AS_LOGIN });
    const hashedPwd = hash(data.password);
    console.log(`At login: ${ hashedPwd }`);
    try {
        const response = await api.post(
            '/login',
            { ...data, password: hashedPwd }
            // { ...data }
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
