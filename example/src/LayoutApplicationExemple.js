import React from 'react'
import { Container, Nav, NavDropdown } from 'react-bootstrap'
import { LayoutApplication, HeaderApplication, FooterApplication, IconeConnexion } from '@dugrema/millegrilles.reactjs'

export default props => {

    const iconeConnecte = <IconeConnexion connecte={true} />
    const iconeDeconnecte = <IconeConnexion connecte={false} />

    return (
        <LayoutApplication>
            <HeaderApplication>
                <Nav>
                    <Nav.Item>
                        <Nav.Link title="Exemple">
                            Exemple
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link title="Upload">
                            <i className="fa fa-upload" />Uploads
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link title="Portail">
                            Portail
                        </Nav.Link>
                    </Nav.Item>

                    <Nav.Item>
                        <Nav.Link title="Connexion">
                            {iconeConnecte} / {iconeDeconnecte}
                        </Nav.Link>
                    </Nav.Item>

                    <NavDropdown title="Drop down exemple" id="basic-nav-dropdown" drop="start" className="menu-item">
                        <NavDropdown.Item>
                        Changer Langue
                        </NavDropdown.Item>
                        <NavDropdown.Item>
                        Compte
                        </NavDropdown.Item>
                        <NavDropdown.Item>
                        Deconnecter
                        </NavDropdown.Item>
                    </NavDropdown>
                                    
                </Nav>
            </HeaderApplication>

            <Container className="contenu">
                <h1>Exemple layout application</h1>
                <p>Je veux faire des tests</p>
            </Container>
            
            <FooterApplication>
                <p>Footer</p>
            </FooterApplication>
        </LayoutApplication>
    )
}
