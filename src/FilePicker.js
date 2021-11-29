import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'

import styles from './styles.module.css'

export default props => {
    return (
        <Container className={styles.filepicker}>
            <h1>FilePicker</h1>

            <Row>
                <Col>Repertoire</Col>
                <Col>abcd-1234</Col>
            </Row>

            <div className={styles.liste}>
                <Row><Col xs={1}/><Col>abcd-1235</Col></Row>
            </div>

        </Container>
    )
}