/**
 * Created by thorin on 2017-06-10.
 */
import React, { Component } from 'react';
import { Navbar, Nav, NavItem } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { LinkContainer } from 'react-router-bootstrap';

class Header extends Component {
    render() {
        return (
            <Navbar>
                <Navbar.Header>
                    <Navbar.Brand>
                        <Link to="/">OAuth2 Authorization Server</Link>
                    </Navbar.Brand>
                </Navbar.Header>
                <Nav>
                    {this.props.role === 'admin' ?
                        <LinkContainer to="/users">
                            <NavItem eventKey={1}>Users</NavItem>
                        </LinkContainer>
                        :
                        ''
                    }
                </Nav>
            </Navbar>
        );
    }
}

const mapStateToProps = state => ({
    role: state.auth.role
});

export default connect(mapStateToProps, null)(Header);
