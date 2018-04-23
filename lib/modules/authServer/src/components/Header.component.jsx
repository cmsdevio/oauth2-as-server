/**
 * Created by thorin on 2017-06-10.
 */
import React from 'react';
import { Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Header = () => (
    <Navbar>
        <Navbar.Header>
            <Navbar.Brand>
                <Link to="/">OAuth2 Authorization Server</Link>
            </Navbar.Brand>
        </Navbar.Header>
    </Navbar>
);

export default Header;
