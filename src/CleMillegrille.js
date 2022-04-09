import React, {useEffect, useState, useCallback} from 'react'

import Dropzone from 'react-dropzone'

import Modal from 'react-bootstrap/Modal'
import Form from 'react-bootstrap/Form'
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Alert from 'react-bootstrap/Alert'

import {chargerPemClePriveeEd25519} from '@dugrema/millegrilles.utiljs/src/certificats'

export function ModalChargerCleMillegrille(props) {

    const { show, close, supportCodeQr, setCle, DEBUG} = props

    const [motDePasse, setMotDePasse] = useState('')
    const [cleChiffree, setCleChiffree] = useState('')
    const [erreurChargement, setErreurChargement] = useState(false)

    const setMotDePasseCb = useCallback(event=>{
        const value = event.currentTarget.value
        if(DEBUG) console.debug("Mot de passe: %s", value)
        setMotDePasse(value)
    }, [setMotDePasse, DEBUG])

    useEffect(()=>{
        if(cleChiffree && motDePasse) {
            if(DEBUG) console.debug("Tenter de dechiffrer cle avec mot de passe")
            try {
                const clePrivee = chargerPemClePriveeEd25519(cleChiffree, {pemout: true, password: motDePasse})
                if(DEBUG) console.debug("Cle privee dechiffre : %O", clePrivee)
                setCle(clePrivee)
                setMotDePasse('')
                setCleChiffree('')
                close()
            } catch(err) {
                console.error("Erreur dechiffrage cle : %O", err)
                setErreurChargement(err, 'Erreur de chargement de la cle')
            }
        }
    }, [cleChiffree, motDePasse, close, setCle, setMotDePasse, setCleChiffree, setErreurChargement])

    const subProps = {
        motDePasse, setMotDePasseCb, setCleChiffree, erreurCb: setErreurChargement, DEBUG,
    }

    return (
        <Modal show={show} onHide={close}>
            <Modal.Header closeButton>
                Charger la cle de MilleGrille
            </Modal.Header>

            <Container>
                {supportCodeQr?
                    <Tabs defaultActiveKey="qr" id="tab-code">
                        <Tab eventKey="qr" title="Code QR">
                            <ScanCle {...subProps} />
                        </Tab>
                        <Tab eventKey="upload" title="Telecharger">
                            <UploadCle {...subProps} />
                        </Tab>
                    </Tabs>
                    :
                    <UploadCle {...subProps} />
                }

                <br />

                <Alert variant="danger" show={erreurChargement?true:false}>
                    <Alert.Heading>Erreur</Alert.Heading>
                    <p>Erreur de verification de la cle, veuillez essayer a nouveau.</p>
                </Alert>

                <br />

            </Container>
        </Modal>
    )

}

function UploadCle(props) {

    const {motDePasse, setMotDePasseCb, setCleChiffree, erreurCb, DEBUG} = props

    const acceptCb = useCallback(acceptedFiles=>{
        if(DEBUG) console.debug("Accepted files : %O", acceptedFiles)
        traiterUploads(acceptedFiles)
            .then(item=>{
                const cleChiffree = item.racine?item.racine.cleChiffree:''
                if(DEBUG) console.debug("Item uploads cle : %O (complet: %O)", cleChiffree, item)
                setCleChiffree(cleChiffree)
            })
            .catch(err=>erreurCb(err))
    }, [erreurCb])

    return (
        <div>
            <h2>Upload cle</h2>

            <Form.Group as={Row} controlId="formGroupPassword">
                <Form.Label column={3}>Mot de passe</Form.Label>
                <Col>
                    <Form.Control 
                        type="password" 
                        placeholder="Mot de passe" 
                        value={motDePasse}
                        onChange={setMotDePasseCb} />
                </Col>
            </Form.Group>

            <Row>
                <Col md={3}>Telecharger</Col>
                <Col>
                    <Button>
                        <Dropzone onDrop={acceptCb}>
                            {({getRootProps, getInputProps}) => (
                                <section className="uploadIcon">
                                <div {...getRootProps()}>
                                    <input {...getInputProps()} />
                                    <span className="fa fa-upload fa-2x"/>
                                </div>
                                </section>
                            )}
                        </Dropzone>
                    </Button>
                </Col>
            </Row>

        </div>
    )
}

function ScanCle(props) {
    return (
        <div>
            <p>Scan cle</p>
        </div>
    )
}

async function traiterUploads(acceptedFiles) {

    const resultats = await Promise.all(acceptedFiles.map(async file =>{
      if( file.type === 'application/json' ) {
        var reader = new FileReader();
        const fichierCharge = await new Promise((resolve, reject)=>{
          reader.onload = () => {
            var buffer = reader.result;
            const contenuFichier =  String.fromCharCode.apply(null, new Uint8Array(buffer));
            resolve({contenuFichier});
          }
          reader.onerror = err => {
            reject(err);
          }
          reader.readAsArrayBuffer(file);
        })
  
        const contenuJson = JSON.parse(fichierCharge.contenuFichier)
  
        return contenuJson
      }
    }))
  
    return resultats.pop()
  }
