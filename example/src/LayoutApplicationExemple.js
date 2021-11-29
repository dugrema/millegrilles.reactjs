import React from 'react'
import { Container, Nav } from 'react-bootstrap'
import { LayoutApplication, HeaderApplication, FooterApplication, BodyApplication } from 'millegrilles.reactjs'

export default props => {
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
