import React, { useState, useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

export function ModalErreur(props) {

    const { show, err, message, titre, fermer } = props

    const [afficherDetail, setAfficherDetail] = useState(false)
    const handlerAfficherDetail = () => setAfficherDetail(true)

    // Reset bouton detail
    useEffect(()=>setAfficherDetail(false), [show, err, setAfficherDetail])

    let messageStr = message, erreurStr = null, stack = null
    if(err) {
        if(typeof(err) === 'string') erreurStr = err
        else {
            erreurStr = ''+err
            stack = err.stack
        }
    }

    return (
        <Modal show={show} onHide={fermer} size='lg'>
            <Modal.Header closeButton>{titre}</Modal.Header>
            <p>{messageStr}</p>
            <p>{erreurStr}</p>
            <AfficherStack show={afficherDetail} stack={stack} handlerAfficher={handlerAfficherDetail} />
        </Modal>
    )

}

function AfficherStack(props) {
    const {show, stack, handlerAfficher} = props
    if(show) {
        return <pre>{stack}</pre>
    }

    if(stack) {
        return (
            <Row>
                <Col>
                    <Button onClick={handlerAfficher}>Detail</Button>
                </Col>
            </Row>
        )
    }

    return ''
}