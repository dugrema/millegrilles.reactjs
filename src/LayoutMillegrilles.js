import React, { useMemo } from 'react'

import { useTranslation, initReactI18next } from 'react-i18next'

import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Offcanvas from 'react-bootstrap/Offcanvas'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import Modal from 'react-bootstrap/Modal'
import Fade from 'react-bootstrap/Fade'

import 'font-awesome/css/font-awesome.min.css'

function LayoutMillegrilles(props) {

    const { menu, children } = props

    return (
        <div className="flexwrapper">
            <div className="applicationlayout">
                <div className="header">
                    {menu}
                </div>
            </div>
            <Container className="contenu">
                {children}            
            </Container>
        </div>
    )

}

export default LayoutMillegrilles

export function initI18n(instance) {
    initReactI18next.init(instance)
}

export function Menu(props) {

    const { brand, labelMenu, etatConnexion, onSelect, children } = props

    const expand = props.expand || 'md'

    const OverlayDeconnecte = useMemo(()=>{
        if(etatConnexion === true) return () => <span/>
        return DeconnecteInfo
    }, [etatConnexion])

    return (
        <Navbar collapseOnSelect expand={expand}>
           
            {brand}

            <Navbar.Offcanvas id="responsive-navbar-menu" placement="end">
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title id='offcanvasNavbarLabel-expand'>
                        {labelMenu?labelMenu:'Menu'}
                    </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <Nav onSelect={onSelect}>
                        {children}
                    </Nav>
                </Offcanvas.Body>
            </Navbar.Offcanvas>

            <div className="menu-section-droite">
                <Fade in={!etatConnexion}>
                    <div id="etatConnexion">
                        <OverlayTrigger delay={{ show: 250, hide: 400 }} placement="bottom" overlay={OverlayDeconnecte}>
                            <span className="fa-stack fa-lg">
                                <i className="fa fa-wifi fa-stack-1x"></i>
                                <i className="fa fa-ban fa-stack-2x text-danger"></i>
                            </span>
                        </OverlayTrigger>
                    </div>
                </Fade>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
            </div>

        </Navbar>
    )
}

function DeconnecteInfo(props) {
    return (
        <Tooltip id="button-tooltip" {...props}>
            La connexion au serveur a ete perdue. Reconnexion en cours ...
        </Tooltip>
    )
}

export function DropDownLanguage(props) {
    const { title, children, onSelect } = props
    // <NavDropdown.Item eventKey="en-US">English</NavDropdown.Item>
    return (
        <NavDropdown title={title} id="basic-nav-dropdown" drop="down" onSelect={onSelect}>
            {children}
        </NavDropdown>
    )
}

export function ModalInfo(props) {

    const { manifest, idmg, contact, usager } = props

    const { t } = useTranslation()

    if(!manifest) return ''

    const { version, date } = manifest

    return (
        <Modal show={props.show} onHide={props.fermer}>
            <Modal.Header closeButton>{t('layout-millegrilles.modal-info-titre')}</Modal.Header>
            <Modal.Body>
                <AfficherUsager usager={usager} />
                <h3>{t('layout-millegrilles.modal-info-application')}</h3>
                <Row>
                    <Col xs={3} sm={2}>{t('layout-millegrilles.modal-info-nom')}</Col><Col>{t('application.nom')}</Col>
                </Row>
                <Row>
                    <Col xs={3} sm={2}>{t('layout-millegrilles.modal-info-version')}</Col><Col>{version}</Col>
                </Row>
                <Row>
                    <Col xs={3} sm={2}>{t('layout-millegrilles.modal-info-date')}</Col><Col>{date}</Col>
                </Row>
                <h3>{t('layout-millegrilles.modal-info-systeme')}</h3>
                <Row><Col>{t('layout-millegrilles.idmg')}</Col></Row>
                <Row><Col className="idmg">{idmg}</Col></Row>
                <AfficherContact contact={contact} />
            </Modal.Body>
        </Modal>
    )
}

function AfficherContact(props) {

    const { contact } = props

    const { t } = useTranslation()

    if(!contact) return ''

    const info = []

    if(contact.email) {
        info.push(
            <Row>
                <Col xs={3} sm={2}>{t('layout-millegrilles.contact-email')}</Col><Col><Nav.Link href={`mailto:${email}`}>{email}</Nav.Link></Col>
            </Row>
        )
    }
    if(contact.millegrille) {
        info.push(
            <Row>
                <Col xs={3} sm={2}>{t('layout-millegrilles.contact-millegrille')}</Col><Col>{millegrille}</Col>
            </Row>
        )
    }

    return (
        <div>
            <h3>{t('layout-millegrilles.contact-titre')}</h3>
            {info}
        </div>
    )
}

function AfficherUsager(props) {
    const usager = props.usager || {}
    const nomUsager = usager.nomUsager

    const { t } = useTranslation()

    return (
        <div>
            <h3>{t('layout-millegrilles.usager-titre')}</h3>
            <Row>
                <Col xs={3} sm={2}>{t('layout-millegrilles.usager-nom')}</Col><Col>{nomUsager}</Col>
            </Row>
        </div>
    )    
}